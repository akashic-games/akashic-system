import "jest";
import config from "config";
import { AmqpChannelHolder, AmqpConnectionManager } from "@akashic/amqp-utils";
import { AMQPPlaylogPublisher } from "../AMQPPlaylogPublisher";
import { AMQPPlaylogQueue } from "../AMQPPlaylogQueue";
import type { Tick, Event } from "@akashic/playlog";
import { eventQueueNamePrefix } from "../constants";

function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("AMQPPlaylogQueueの正常系以外のテスト", () => {
	const tick: Tick = [1];
	const event: Event = [1, 0, null];

	it("二回subscribeを呼んでも最初の1回目しか呼ばれない", async () => {
		// 初期化処理
		const amqpManager = new AmqpConnectionManager({
			urls: config.get("rabbitmq.url"),
		});
		await amqpManager.init();
		const amqpChannel = new AmqpChannelHolder(amqpManager);

		const playId = "11123";
		// publisherとキューを準備
		const publisher = new AMQPPlaylogPublisher(amqpChannel);
		await publisher.prepare(playId);
		await publisher.start();
		const queue = new AMQPPlaylogQueue(amqpChannel);
		await queue.start();
		const queueCallback = {
			onEventMessage: jest.fn().mockResolvedValue(undefined),
			onTickMessage: jest.fn().mockResolvedValue(undefined),
		};
		// 2回呼ぶ
		await queue.subscribe(playId, queueCallback);
		await queue.subscribe(playId, queueCallback);
		// publishする
		await publisher.publishEvent(playId, event);
		await publisher.publishTick(playId, tick);
		// AMQPを待つ
		await wait(200);
		// 呼ばれた回数チェック
		expect(queueCallback.onEventMessage.mock.calls.length).toBe(1);
		expect(queueCallback.onTickMessage.mock.calls.length).toBe(1);

		// 終了処理
		await publisher.stop();
		await queue.stop();
		await amqpChannel.stop();
		await amqpManager.close();
	});

	it("unsubscribeを呼ぶと呼ばれない", async () => {
		// 初期化処理
		const amqpManager = new AmqpConnectionManager({
			urls: config.get("rabbitmq.url"),
		});
		await amqpManager.init();
		const amqpChannel = new AmqpChannelHolder(amqpManager);
		const playId = "11124";
		// publisherとキューを準備
		const publisher = new AMQPPlaylogPublisher(amqpChannel);
		await publisher.prepare(playId);
		await publisher.start();
		const queue = new AMQPPlaylogQueue(amqpChannel);
		await queue.start();
		const queueCallback = {
			onEventMessage: jest.fn().mockResolvedValue(undefined),
			onTickMessage: jest.fn().mockResolvedValue(undefined),
		};

		// 先にunsubscribeしても何もおきない
		await queue.unsubscribe(playId);
		// 購読する
		await queue.subscribe(playId, queueCallback);
		// publishする
		await publisher.publishEvent(playId, event);
		await publisher.publishTick(playId, tick);
		// AMQPを待つ
		await wait(200);
		// 呼ばれた回数チェック
		expect(queueCallback.onEventMessage.mock.calls.length).toBe(1);
		expect(queueCallback.onTickMessage.mock.calls.length).toBe(1);
		// unsubscribeする
		await queue.unsubscribe(playId);
		// publishする
		await publisher.publishEvent(playId, event);
		await publisher.publishTick(playId, tick);
		// AMQPを待つ
		await wait(200);
		// 呼ばれた回数チェック
		expect(queueCallback.onEventMessage.mock.calls.length).toBe(1);
		expect(queueCallback.onTickMessage.mock.calls.length).toBe(1);
		// メッセージが残っていると他のテスト壊しかねないので消化しておく
		await queue.subscribe(playId, queueCallback);
		await wait(200);

		// 終了処理
		await publisher.stop();
		await queue.stop();
		await amqpChannel.stop();
		await amqpManager.close();
	});

	it("サブスクリプションをセットしない場合はqueueは消費されない", async () => {
		// 初期化処理
		const amqpManager = new AmqpConnectionManager({
			urls: config.get("rabbitmq.url"),
		});
		await amqpManager.init();
		const amqpChannel = new AmqpChannelHolder(amqpManager);
		const playId = "11125";
		// publisherとキューを準備
		const publisher = new AMQPPlaylogPublisher(amqpChannel);
		await publisher.prepare(playId);
		await publisher.start();
		const queue = new AMQPPlaylogQueue(amqpChannel);
		await queue.start();
		const queueCallback = {};

		// 購読する
		await queue.subscribe(playId, queueCallback);
		// publishする
		await publisher.publishEvent(playId, event);
		await publisher.publishTick(playId, tick);
		// AMQPを待つ
		await wait(200);
		// unsubscribeする
		await queue.unsubscribe(playId);
		// 改めて別のsubscriptionを入れる
		const queueCallback2 = {
			onEventMessage: jest.fn().mockResolvedValue(undefined),
			onTickMessage: jest.fn().mockResolvedValue(undefined),
		};
		// 購読する
		await queue.subscribe(playId, queueCallback2);
		// AMQPを待つ
		await wait(200);
		// 呼ばれた回数チェック(eventは永続的だが、tickは揮発性なのでこういう違いが出る)
		expect(queueCallback2.onEventMessage.mock.calls.length).toBe(1);
		expect(queueCallback2.onTickMessage.mock.calls.length).toBe(0);

		// 終了処理
		await publisher.stop();
		await queue.stop();
		await amqpChannel.stop();
		await amqpManager.close();
	});

	it("AMQPのチャンネルが壊れても問題なくメッセージは届く", async () => {
		// 初期化処理
		const amqpManager = new AmqpConnectionManager({
			urls: config.get("rabbitmq.url"),
		});
		await amqpManager.init();
		const amqpChannel = new AmqpChannelHolder(amqpManager);
		const playId = "11126";
		// publisherとキューを準備
		const publisher = new AMQPPlaylogPublisher(amqpChannel);
		await publisher.prepare(playId);
		await publisher.start();
		const queue = new AMQPPlaylogQueue(amqpChannel);
		await queue.start();
		const queueCallback = {
			onEventMessage: jest.fn().mockResolvedValue(undefined),
			onTickMessage: jest.fn().mockResolvedValue(undefined),
		};
		const errorSpy = jest.fn();
		queue.addListener("error", errorSpy);

		await queue.subscribe(playId, queueCallback);
		// チャンネル壊す
		const channel = await amqpChannel.getChannel();
		await expect(channel.checkExchange("not-found-exchange")).rejects.toThrow(/.*NOT_FOUND.*/);
		// AMQPPlaylogQueueは「揮発性」のキューのため、復旧してからpublishしないとデータがロストするため、復旧を待つ
		await wait(200);
		// publishする
		await publisher.publishEvent(playId, event);
		await publisher.publishTick(playId, tick);
		// AMQPを待つ
		await wait(200);
		// 呼ばれた回数チェック
		expect(queueCallback.onEventMessage.mock.calls.length).toBe(1);
		expect(queueCallback.onTickMessage.mock.calls.length).toBe(1);
		expect(errorSpy.mock.calls.length).toBe(0);

		// 終了処理
		await publisher.stop();
		await queue.stop();
		await amqpChannel.stop();
		await amqpManager.close();
	});

	it("AMQPのチャンネルが壊れた時の再接続が失敗したとき、error イベントが 1 回呼ばれる", async () => {
		// 初期化処理
		const amqpManager = new AmqpConnectionManager({
			urls: config.get("rabbitmq.url"),
		});
		await amqpManager.init();
		const amqpChannel = new AmqpChannelHolder(amqpManager);
		const playId = "11127";
		// publisherとキューを準備
		const publisher = new AMQPPlaylogPublisher(amqpChannel);
		await publisher.prepare(playId);
		await publisher.start();
		const queue = new AMQPPlaylogQueue(amqpChannel);
		await queue.start();
		const queueCallback = {
			onEventMessage: jest.fn().mockResolvedValue(undefined),
			onTickMessage: jest.fn().mockResolvedValue(undefined),
		};
		const errorSpy = jest.fn();
		queue.addListener("error", errorSpy);

		await queue.subscribe(playId, queueCallback);
		// チャンネル壊しつつ、eventのconsume時だけ壊す
		const channel = await amqpChannel.getChannel();
		const getChannelOrig = amqpChannel.getChannel;
		amqpChannel.getChannel = jest.fn().mockImplementation(async () => {
			const c = await getChannelOrig.bind(amqpChannel)();
			const consumeOrig = c.consume;
			c.consume = jest.fn().mockImplementation(async (queueName: string, ...rest: unknown[]) => {
				if (queueName.startsWith(eventQueueNamePrefix)) {
					throw new Error("test");
				}
				// @ts-ignore
				return consumeOrig.apply(c, [queueName, ...rest]);
			});
			return c;
		});
		await expect(channel.checkExchange("not-found-exchange")).rejects.toThrow(/.*NOT_FOUND.*/);
		// AMQPを待つ
		await wait(200);
		// 完全に壊れているのでエラーイベント投げたのを確認
		expect(errorSpy.mock.calls.length).toBe(1);
		// 終了処理を壊さないように戻す
		amqpChannel.getChannel = getChannelOrig;

		// 終了処理
		await publisher.stop();
		await queue.stop();
		await amqpChannel.stop();
		await amqpManager.close();
	});

	it("consume処理内でエラーが起きても再送してくれる", async () => {
		// 初期化処理
		const amqpManager = new AmqpConnectionManager({
			urls: config.get("rabbitmq.url"),
		});
		await amqpManager.init();
		const amqpChannel = new AmqpChannelHolder(amqpManager);
		const playId = "11128";
		// publisherとキューを準備
		const publisher = new AMQPPlaylogPublisher(amqpChannel);
		await publisher.prepare(playId);
		await publisher.start();
		const queue = new AMQPPlaylogQueue(amqpChannel);
		const errorSpy = jest.fn();
		queue.addListener("error", errorSpy);
		await queue.start();

		let eventFlag = false;
		// 細工したコールバック
		const queueCallback = {
			onEventMessage: jest.fn().mockImplementation(async () => {
				if (!eventFlag) {
					eventFlag = true;
					throw new Error("一回目はエラー");
				}
			}),
			onTickMessage: jest.fn().mockResolvedValue(undefined), // tickには再送機能無し
		};
		// 購読
		await queue.subscribe(playId, queueCallback);
		// publishする
		await publisher.publishEvent(playId, event);
		await publisher.publishTick(playId, tick);
		// AMQPを待つ
		await wait(200);
		// 呼ばれた回数チェック
		expect(queueCallback.onEventMessage.mock.calls.length).toBe(2);
		expect(queueCallback.onTickMessage.mock.calls.length).toBe(1);
		expect(eventFlag).toBe(true);
		expect(errorSpy.mock.calls.length).toBe(1);

		// 終了処理
		await publisher.stop();
		await queue.stop();
		await amqpChannel.stop();
		await amqpManager.close();
	});
});
