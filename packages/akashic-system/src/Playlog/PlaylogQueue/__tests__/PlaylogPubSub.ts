import "jest";
import config from "config";
import { AmqpConnectionManager, AmqpChannelHolder } from "@akashic/amqp-utils";
import { Tick, Event } from "@akashic/playlog";
import { StartPoint } from "@akashic/amflow";
import { AMQPPlaylogPublisher } from "../AMQPPlaylogPublisher";
import { AMQPPlaylogStoreQueue } from "../AMQPPlaylogStoreQueue";
import { AMQPPlaylogQueue } from "../AMQPPlaylogQueue";
import {
	tickDlxName,
	startPointDlxName,
	tickStoreDeadLetterQueueName,
	startPointStoreDeadLetterQueueName,
	getExchangeNames,
	getQueueNames,
} from "../constants";
import { PlaylogQueueCallback } from "../IPlaylogQueue";

function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("playlogのpubsub周りの正常系のlargeテスト", () => {
	const ticks: Tick[] = [[0], [1], [2]];
	const startPoint: StartPoint = {
		frame: 0,
		timestamp: 12345678,
		data: "",
	};
	const events: Event[] = [
		[0, 0, null],
		[2, 0, null],
	];

	it("Dead Letter Exchange と Dead Letter Queue が publisher#start 時に作られる", async () => {
		// 初期化
		const amqpManager = new AmqpConnectionManager({
			urls: config.get("rabbitmq.url"),
		});
		await amqpManager.init();
		const amqpChannel = new AmqpChannelHolder(amqpManager);

		const publisher = new AMQPPlaylogPublisher(amqpChannel);
		await publisher.start();

		const channel = await amqpChannel.getChannel();
		await channel.checkExchange(tickDlxName);
		await channel.checkExchange(startPointDlxName);
		await channel.checkQueue(tickStoreDeadLetterQueueName);
		await channel.checkQueue(startPointStoreDeadLetterQueueName);

		// 終了処理
		await publisher.stop();
		await amqpChannel.stop();
		await amqpManager.close();
	});

	it("publisherのprepareを呼ぶと、該当playIdのexchangeとqueueが作られる", async () => {
		const playId = "109843121";
		// 初期化
		const amqpManager = new AmqpConnectionManager({
			urls: config.get("rabbitmq.url"),
		});
		await amqpManager.init();
		const amqpChannel = new AmqpChannelHolder(amqpManager);

		const publisher = new AMQPPlaylogPublisher(amqpChannel);
		await publisher.start();
		await publisher.prepare(playId);

		const channel = await amqpChannel.getChannel();
		expect(channel).not.toBeNull();

		const { tickBroadcastExchangeName, tickStoreExchangeName, startPointStoreExchangeName, eventExchangeName } = getExchangeNames(playId);
		const { tickStoreQueueName, startPointStoreQueueName } = getQueueNames(playId);

		await channel.checkExchange(tickBroadcastExchangeName);
		await channel.checkExchange(tickStoreExchangeName);
		await channel.checkExchange(startPointStoreExchangeName);
		await channel.checkExchange(eventExchangeName);
		await channel.checkQueue(tickStoreQueueName);
		await channel.checkQueue(startPointStoreQueueName);
		// 終了処理
		await publisher.stop();
		await amqpChannel.stop();
		await amqpManager.close();
	});

	it("publisherのprepareを呼ぶ前にsubscribeしても、エラーにならず、undefined が返ってくる", async () => {
		const playId = "109843122";
		// 初期化
		const amqpManager = new AmqpConnectionManager({
			urls: config.get("rabbitmq.url"),
		});
		await amqpManager.init();
		const amqpChannel = new AmqpChannelHolder(amqpManager);

		const callbacks = {
			onEventMessage: jest.fn(),
			onStartPointMessage: jest.fn(),
			onTickMessage: jest.fn(),
		};
		const storeQueue = new AMQPPlaylogStoreQueue(amqpChannel);

		expect(await storeQueue.subscribe(playId, callbacks)).toBeUndefined();
		// 終了処理
		await storeQueue.stop();
		await amqpChannel.stop();
		await amqpManager.close();
	});

	it("tick, startPoint, eventがそれぞれpublishとsubscribe出来るか", async () => {
		const playId = "109843123";
		// 初期化
		const amqpManager = new AmqpConnectionManager({
			urls: config.get("rabbitmq.url"),
		});
		await amqpManager.init();
		const amqpChannel = new AmqpChannelHolder(amqpManager);

		const storedQueueStartPoint: StartPoint[] = [];
		const storedQueueTick: Tick[] = [];
		const storeQueueCallback: PlaylogQueueCallback = {
			onStartPointMessage: async (_, sp) => {
				storedQueueStartPoint.push(sp);
			},
			onTickMessage: async (_, t) => {
				storedQueueTick.push(t);
			},
		};

		const queuedEvents: Event[] = [];
		const queuedTick: Tick[] = [];
		const queueCallback: PlaylogQueueCallback = {
			onEventMessage: async (_, sp) => {
				queuedEvents.push(sp);
			},
			onTickMessage: async (_, t) => {
				queuedTick.push(t);
			},
		};

		// publisherは先にpublishする(ActiveAEが先にpublishを開始する一般的なシナリオ)
		const publisher = new AMQPPlaylogPublisher(amqpChannel);
		await publisher.start();
		await publisher.prepare(playId);

		await publisher.publishStartPoint(playId, startPoint);
		await publisher.publishTick(playId, ticks[0]);

		// キューは後付けでsubscribeする
		const storeQueue = new AMQPPlaylogStoreQueue(amqpChannel);
		await storeQueue.start();
		expect(storeQueueCallback).not.toBeNull();

		await storeQueue.subscribe(playId, storeQueueCallback);
		const queue = new AMQPPlaylogQueue(amqpChannel);
		await queue.start();
		await queue.subscribe(playId, queueCallback);

		// amqp処理待ち
		await wait(200);

		// storeQueueの方は先にpublishした情報が取れる
		expect(storedQueueStartPoint.length).toBe(1);
		expect(storedQueueTick.length).toBe(1);
		// 普通のキューは先にpublishした情報は取れない
		expect(queuedTick.length).toBe(0);
		expect(queuedEvents.length).toBe(0);

		// 次の情報をpublish
		await publisher.publishTick(playId, ticks[1]);
		await publisher.publishEvent(playId, events[0]);

		// amqp処理待ち
		await wait(200);

		// storeQueueの方はpublishした情報が取れる
		expect(storedQueueStartPoint.length).toBe(1);
		expect(storedQueueTick.length).toBe(2);
		// 普通のキューもpublishした情報が取れる
		expect(queuedTick.length).toBe(1);
		expect(queuedEvents.length).toBe(1);

		// 存在しないplayを購読した場合は undefined になる
		expect(await storeQueue.subscribe("invalid", storeQueueCallback)).toBeUndefined();

		// amqp処理待ち
		await wait(200);

		// エラーを引き起こしてもpubsubは問題ない
		await publisher.publishTick(playId, ticks[2]);

		// amqp処理待ち
		await wait(300);

		expect(storedQueueTick.length).toBe(3);
		expect(queuedTick.length).toBe(2);

		// 終了処理
		await publisher.stop();
		await storeQueue.stop();
		await queue.stop();
		await amqpChannel.stop();
		await amqpManager.close();
	});

	it("exchangeを準備せずにAMQPPlaylogPublisher#publishやAMQPPlaylogQueue#subscribeを呼ぶと、ドライバの仕様上queueの方だけエラーになる", async () => {
		const playId = "2314098734";
		// 初期化
		const amqpManager = new AmqpConnectionManager({
			urls: config.get("rabbitmq.url"),
		});
		await amqpManager.init();
		const amqpChannel = new AmqpChannelHolder(amqpManager);
		const publisher = new AMQPPlaylogPublisher(amqpChannel);
		await publisher.start();
		const queue = new AMQPPlaylogQueue(amqpChannel);
		await queue.start();

		await publisher.publishTick(playId, ticks[0]);
		await expect(
			queue.subscribe(playId, {
				onTickMessage: async () => {
					/* no-op */
				},
			}),
		).rejects.toThrow(/NOT-FOUND/);
	});

	it("exchangeを準備して、subscribeしてexchangeを消してもエラーは起きない", async () => {
		const playId = "2314098735";
		// 初期化
		const amqpManager = new AmqpConnectionManager({
			urls: config.get("rabbitmq.url"),
		});
		await amqpManager.init();
		const amqpChannel = new AmqpChannelHolder(amqpManager);
		const queue = new AMQPPlaylogQueue(amqpChannel);
		await queue.start();
		const channel = await amqpChannel.getChannel();
		const { tickBroadcastExchangeName } = getExchangeNames(playId);
		await channel.assertExchange(tickBroadcastExchangeName, "fanout", { durable: false, autoDelete: false });

		await queue.subscribe(playId, {
			onTickMessage: async () => {
				/* no-op */
			},
		});
		await channel.deleteExchange(tickBroadcastExchangeName);
		await queue.unsubscribe(playId);
	});

	it("AMQPPlaylogQueueは、exchangeが消えた後に再接続が走った場合、errorイベントが一回だけ飛び、自動で購読解除される(消えたexchangeを無限に再講読しないようにする対応)", async () => {
		const playId = "2314098736";
		// 初期化
		const amqpManager = new AmqpConnectionManager({
			urls: config.get("rabbitmq.url"),
		});
		await amqpManager.init();
		const amqpChannel = new AmqpChannelHolder(amqpManager);
		const q = new (class extends AMQPPlaylogQueue {
			hasSubscription(id: string) {
				return this.subscriptionMap.has(id);
			}
		})(amqpChannel);
		await q.start();
		const channel = await amqpChannel.getChannel();
		const { tickBroadcastExchangeName } = getExchangeNames(playId);
		await channel.assertExchange(tickBroadcastExchangeName, "fanout", { durable: false, autoDelete: false });
		const errorSpy = jest.fn();
		q.addListener("error", errorSpy);

		await q.subscribe(playId, {
			onTickMessage: async () => {
				/* no-op */
			},
		});
		expect(q.hasSubscription(playId)).toBe(true);

		await channel.deleteExchange(tickBroadcastExchangeName);
		await expect(channel.checkQueue("invalid-queue-name")).rejects.toThrow(/NOT-FOUND/);
		await wait(200); // AMQP再接続待ち

		expect(errorSpy.mock.calls[0][0].code).toBe(404);
		expect(errorSpy.mock.calls.length).toBe(1);
		expect(q.hasSubscription(playId)).toBe(false);
	});
});
