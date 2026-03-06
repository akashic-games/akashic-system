import "jest";
import config from "config";
import { LogLevel, TestLogger } from "@akashic-system/logger";
import { AmqpChannelHolder, AmqpConnectionManager } from "@akashic/amqp-utils";
import { AMQPPlaylogPublisher } from "../AMQPPlaylogPublisher";
import { AMQPPlaylogStoreQueue } from "../AMQPPlaylogStoreQueue";
import {
	playIdHeaderName,
	startPointStoreDeadLetterQueueName,
	startPointStoreQueueNamePrefix,
	tickStoreDeadLetterQueueName,
} from "../constants";
import type { StartPoint } from "@akashic/amflow";
import type { Tick } from "@akashic/playlog";
import type { Options } from "amqplib";
import { encodeStartPoint, encodeTick } from "@akashic/amflow-message";

function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("AMQPPlaylogStoreQueue", () => {
	const tick: Tick = [1];
	const startPoint: StartPoint = {
		frame: 1,
		timestamp: Date.now(),
		data: "",
	};

	it("二回subscribeを呼んでも最初の1回目しか呼ばれない", async () => {
		// 初期化処理
		const amqpManager = new AmqpConnectionManager({
			urls: config.get("rabbitmq.url"),
		});
		await amqpManager.init();
		const amqpChannel = new AmqpChannelHolder(amqpManager);
		const playId = "211123";
		// publisherとキューを準備
		const publisher = new AMQPPlaylogPublisher(amqpChannel);
		await publisher.prepare(playId);
		await publisher.start();
		const queue = new AMQPPlaylogStoreQueue(amqpChannel);
		await queue.start();
		const queueCallback = {
			onStartPointMessage: jest.fn().mockResolvedValue(undefined),
			onTickMessage: jest.fn().mockResolvedValue(undefined),
		};

		// 2回呼ぶ
		await queue.subscribe(playId, queueCallback);
		await queue.subscribe(playId, queueCallback);
		// publishする
		await publisher.publishStartPoint(playId, startPoint);
		await publisher.publishTick(playId, tick);
		// AMQPを待つ
		await wait(200);
		// 呼ばれた回数チェック
		expect(queueCallback.onStartPointMessage.mock.calls.length).toBe(1);
		expect(queueCallback.onTickMessage.mock.calls.length).toBe(1);

		// 終了処理
		await publisher.stop();
		await queue.stop();
		await amqpChannel.stop();
		await amqpManager.close();
	});

	it("onTickMessage/onStartPointMessage両方に関数を渡さないとエラーになる", async () => {
		// 初期化処理
		const amqpManager = new AmqpConnectionManager({
			urls: config.get("rabbitmq.url"),
		});
		await amqpManager.init();
		const amqpChannel = new AmqpChannelHolder(amqpManager);
		const playId = "211124";
		const queue = new AMQPPlaylogStoreQueue(amqpChannel);
		await queue.start();

		// 正しくないコールバックを渡す
		const queueCallback1 = {
			onTickMessage: jest.fn().mockResolvedValue(undefined),
		};
		await expect(queue.subscribe(playId, queueCallback1)).rejects.toThrow("コールバックに必要な関数がセットされていません");
		const queueCallback2 = {
			onStartPointMessage: jest.fn().mockResolvedValue(undefined),
		};
		await expect(queue.subscribe(playId, queueCallback2)).rejects.toThrow("コールバックに必要な関数がセットされていません");
		await expect(queue.subscribe(playId, {})).rejects.toThrow("コールバックに必要な関数がセットされていません");

		// 終了処理
		await queue.stop();
		await amqpChannel.stop();
		await amqpManager.close();
	});

	it("unsubscribeを何もしていないときに呼んでも何も起きない", async () => {
		// 初期化処理
		const amqpManager = new AmqpConnectionManager({
			urls: config.get("rabbitmq.url"),
		});
		await amqpManager.init();
		const amqpChannel = new AmqpChannelHolder(amqpManager);
		const playId = "21112421";
		// publisherとキューを準備
		const publisher = new AMQPPlaylogPublisher(amqpChannel);
		await publisher.prepare(playId);
		await publisher.start();
		const queue = new AMQPPlaylogStoreQueue(amqpChannel);
		await queue.start();

		// 先にunsubscribeしても何もおきない
		await queue.unsubscribe(playId);

		// 終了処理
		await publisher.stop();
		await queue.stop();
		await amqpChannel.stop();
		await amqpManager.close();
	});

	it("unsubscribeを呼ぶと、新規のtick/startPointが届かなくなる", async () => {
		// 初期化処理
		const amqpManager = new AmqpConnectionManager({
			urls: config.get("rabbitmq.url"),
		});
		await amqpManager.init();
		const amqpChannel = new AmqpChannelHolder(amqpManager);
		const playId = "2111242";
		// publisherとキューを準備
		const publisher = new AMQPPlaylogPublisher(amqpChannel);
		await publisher.prepare(playId);
		await publisher.start();
		const queue = new AMQPPlaylogStoreQueue(amqpChannel);
		await queue.start();
		const queueCallback = {
			onStartPointMessage: jest.fn().mockResolvedValue(undefined),
			onTickMessage: jest.fn().mockResolvedValue(undefined),
		};

		// 購読する
		await queue.subscribe(playId, queueCallback);
		// publishする
		await publisher.publishStartPoint(playId, startPoint);
		await publisher.publishTick(playId, tick);
		// AMQPを待つ
		await wait(200);
		// 呼ばれた回数チェック
		expect(queueCallback.onStartPointMessage.mock.calls.length).toBe(1);
		expect(queueCallback.onTickMessage.mock.calls.length).toBe(1);
		// unsubscribeする
		await queue.unsubscribe(playId);
		// publishする
		await publisher.publishStartPoint(playId, startPoint);
		await publisher.publishTick(playId, tick);
		// AMQPを待つ
		await wait(200);
		// 呼ばれた回数チェック
		expect(queueCallback.onStartPointMessage.mock.calls.length).toBe(1);
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

	it("購読前にpublishしたtickやstartpointであっても、後から購読したタイミングで届く", async () => {
		// 初期化処理
		const amqpManager = new AmqpConnectionManager({
			urls: config.get("rabbitmq.url"),
		});
		await amqpManager.init();
		const amqpChannel = new AmqpChannelHolder(amqpManager);
		const playId = "211125";
		// publisherとキューを準備
		const publisher = new AMQPPlaylogPublisher(amqpChannel);
		await publisher.prepare(playId);
		await publisher.start();
		const queue = new AMQPPlaylogStoreQueue(amqpChannel);
		await queue.start();

		// ここでは購読しない
		// publishする
		await publisher.publishStartPoint(playId, startPoint);
		await publisher.publishTick(playId, tick);
		// AMQPを待つ
		await wait(200);
		// unsubscribeする
		await queue.unsubscribe(playId);
		// 改めて別のsubscriptionを入れる
		const queueCallback = {
			onStartPointMessage: jest.fn().mockResolvedValue(undefined),
			onTickMessage: jest.fn().mockResolvedValue(undefined),
		};
		// 購読する
		await queue.subscribe(playId, queueCallback);
		// AMQPを待つ
		await wait(200);
		// 呼ばれた回数チェック(両方とも不揮発性なので、データが来る)
		expect(queueCallback.onStartPointMessage.mock.calls.length).toBe(1);
		expect(queueCallback.onTickMessage.mock.calls.length).toBe(1);

		// 終了処理
		await publisher.stop();
		await queue.stop();
		await amqpChannel.stop();
		await amqpManager.close();
	});

	it("AMQPのチャンネルが壊れても、内部で自動的に修復されて問題なくメッセージは届く", async () => {
		// 初期化処理
		const amqpManager = new AmqpConnectionManager({
			urls: config.get("rabbitmq.url"),
		});
		await amqpManager.init();
		const amqpChannel = new AmqpChannelHolder(amqpManager);
		const playId = "211126";
		// publisherとキューを準備
		const publisher = new AMQPPlaylogPublisher(amqpChannel);
		await publisher.prepare(playId);
		await publisher.start();
		const queue = new AMQPPlaylogStoreQueue(amqpChannel);
		await queue.start();
		const queueCallback = {
			onStartPointMessage: jest.fn().mockResolvedValue(undefined),
			onTickMessage: jest.fn().mockResolvedValue(undefined),
		};
		const errorSpy = jest.fn();
		queue.addListener("error", errorSpy);
		await queue.subscribe(playId, queueCallback);

		// チャンネル壊す
		const channel = await amqpChannel.getChannel();
		await expect(channel.checkExchange("not-found-exchange")).rejects.toThrow("NOT_FOUND");
		// publishする
		await publisher.publishStartPoint(playId, startPoint);
		await publisher.publishTick(playId, tick);
		// AMQPを待つ
		await wait(200);
		// 呼ばれた回数チェック
		expect(queueCallback.onStartPointMessage.mock.calls.length).toBe(1);
		expect(queueCallback.onTickMessage.mock.calls.length).toBe(1);
		expect(errorSpy.mock.calls.length).toBe(0);

		// 終了処理
		await publisher.stop();
		await queue.stop();
		await amqpChannel.stop();
		await amqpManager.close();
	});

	it("AMQPのチャンネルが壊れて自動修復しようと試みたが、自動修復に失敗したケース", async () => {
		// 初期化処理
		const amqpManager = new AmqpConnectionManager({
			urls: config.get("rabbitmq.url"),
		});
		await amqpManager.init();
		const amqpChannel = new AmqpChannelHolder(amqpManager);
		const playId = "211127";
		// publisherとキューを準備
		const publisher = new AMQPPlaylogPublisher(amqpChannel);
		await publisher.prepare(playId);
		await publisher.start();
		const queue = new AMQPPlaylogStoreQueue(amqpChannel);
		await queue.start();
		const queueCallback = {
			onStartPointMessage: jest.fn().mockResolvedValue(undefined),
			onTickMessage: jest.fn().mockResolvedValue(undefined),
		};
		const errorSpy = jest.fn();
		queue.addListener("error", errorSpy);
		await queue.subscribe(playId, queueCallback);

		// チャンネル壊しつつ、startPointのconsume時だけ壊すように細工する
		const channel = await amqpChannel.getChannel();
		const getChannelOrig = amqpChannel.getChannel;
		amqpChannel.getChannel = jest.fn().mockImplementation(async () => {
			const c = await getChannelOrig.bind(amqpChannel)();
			const consumeOrig = c.consume;
			c.consume = jest.fn().mockImplementation(async (queueName: string, ...rest: unknown[]) => {
				if (queueName.startsWith(startPointStoreQueueNamePrefix)) {
					throw new Error("test");
				}
				// @ts-ignore
				return consumeOrig.apply(c, [queueName, ...rest]);
			});
			return c;
		});
		// 現在のチャンネルを壊して自動修復をkickする
		await expect(channel.checkExchange("not-found-exchange")).rejects.toThrow("NOT_FOUND");
		// 自動修復を待つ
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
		const playId = "211128";
		// publisherとキューを準備
		const publisher = new AMQPPlaylogPublisher(amqpChannel);
		await publisher.prepare(playId);
		await publisher.start();
		const queue = new AMQPPlaylogStoreQueue(amqpChannel);
		const errorSpy = jest.fn();
		queue.addListener("error", errorSpy);
		await queue.start();
		let startPointFlag = false;
		let tickFlag = false;
		// 初回だけエラーが起きるように細工したコールバック
		const queueCallback = {
			onStartPointMessage: jest.fn().mockImplementation(async () => {
				if (!startPointFlag) {
					startPointFlag = true;
					throw new Error("一回目はエラー");
				}
			}),
			onTickMessage: jest.fn().mockImplementation(async () => {
				if (!tickFlag) {
					tickFlag = true;
					throw new Error("一回目はエラー");
				}
			}),
		};
		// 購読
		await queue.subscribe(playId, queueCallback);

		// publishする
		await publisher.publishStartPoint(playId, startPoint);
		await publisher.publishTick(playId, tick);
		// AMQPを待つ
		await wait(200);
		// 呼ばれた回数チェック
		expect(queueCallback.onStartPointMessage.mock.calls.length).toBe(2);
		expect(queueCallback.onTickMessage.mock.calls.length).toBe(2);
		expect(startPointFlag).toBe(true);
		expect(tickFlag).toBe(true);
		expect(errorSpy.mock.calls.length).toBe(2);

		// 終了処理
		await publisher.stop();
		await queue.stop();
		await amqpChannel.stop();
		await amqpManager.close();
	});

	it("DeadLetterキューに来たtick/startpointのリカバリ処理が出来ているかのテスト", async () => {
		// 初期化処理
		const amqpManager = new AmqpConnectionManager({
			urls: config.get("rabbitmq.url"),
		});
		await amqpManager.init();
		const amqpChannel = new AmqpChannelHolder(amqpManager);
		const playId = "211129";
		// publisherとキューを準備
		const publisher = new AMQPPlaylogPublisher(amqpChannel);
		await publisher.prepare(playId);
		await publisher.start();
		const queue = new AMQPPlaylogStoreQueue(amqpChannel);
		await queue.start();

		// subscribe
		const queueCallback = {
			onStartPointMessage: jest.fn().mockResolvedValue(undefined),
			onTickMessage: jest.fn().mockResolvedValue(undefined),
		};
		await queue.subscribeDeadLetter(queueCallback);
		// AMQPを待つ
		await wait(200);
		const options: Options.Publish = {
			persistent: true,
			headers: {
				// dead-letter時にどのplayIdが分かるようにplayIdを付与
				[playIdHeaderName]: playId,
			},
		};
		const channel = await amqpChannel.getChannel();
		channel.sendToQueue(tickStoreDeadLetterQueueName, encodeTick(tick), options);
		channel.sendToQueue(startPointStoreDeadLetterQueueName, encodeStartPoint(startPoint), options);
		// 処理待ち
		await wait(200);
		expect(queueCallback.onTickMessage.mock.calls.length).toBe(1);
		expect(queueCallback.onStartPointMessage.mock.calls.length).toBe(1);
		// ヘッダつけてないパターン
		const options2: Options.Publish = {
			persistent: true,
		};
		channel.sendToQueue(tickStoreDeadLetterQueueName, encodeTick(tick), options2);
		channel.sendToQueue(startPointStoreDeadLetterQueueName, encodeStartPoint(startPoint), options2);
		// 処理待ち
		await wait(200);
		expect(queueCallback.onTickMessage.mock.calls.length).toBe(1);
		expect(queueCallback.onStartPointMessage.mock.calls.length).toBe(1);
		// ヘッダつけてないパターン(logger付き)
		const loggerSpy = new TestLogger();
		queue.logger = loggerSpy;
		channel.sendToQueue(tickStoreDeadLetterQueueName, encodeTick(tick), options2);
		channel.sendToQueue(startPointStoreDeadLetterQueueName, encodeStartPoint(startPoint), options2);
		// 処理待ち
		await wait(200);
		expect(queueCallback.onTickMessage.mock.calls.length).toBe(1);
		expect(queueCallback.onStartPointMessage.mock.calls.length).toBe(1);
		expect(loggerSpy.hasRecords(LogLevel.WARN)).toBe(true);

		// 終了処理
		await publisher.stop();
		await queue.stop();
		await amqpChannel.stop();
		await amqpManager.close();
	});

	it("hasMessageとdeleteQueueの挙動のテスト", async () => {
		// 初期化処理
		const amqpManager = new AmqpConnectionManager({
			urls: config.get("rabbitmq.url"),
		});
		await amqpManager.init();
		const amqpChannel = new AmqpChannelHolder(amqpManager);
		const playId = "211130";
		// publisherとキューを準備(deleteQueueのテストのために2つ用意)
		const publisher = new AMQPPlaylogPublisher(amqpChannel);
		await publisher.prepare(playId);
		await publisher.start();
		const queue = new AMQPPlaylogStoreQueue(amqpChannel);
		await queue.start();
		const queue2 = new AMQPPlaylogStoreQueue(amqpChannel);
		await queue2.start();

		// 最初はキューは空
		await expect(queue.hasMessage(playId)).resolves.toBe(false);
		// publishする
		await publisher.publishStartPoint(playId, startPoint);
		// キューにデータがある
		await expect(queue.hasMessage(playId)).resolves.toBe(true);
		// subscribeして消費する
		const queueCallback = {
			onStartPointMessage: jest.fn().mockResolvedValue(undefined),
			onTickMessage: jest.fn().mockResolvedValue(undefined),
		};
		await queue.subscribe(playId, queueCallback);
		const queueCallback2 = {
			onStartPointMessage: jest.fn().mockResolvedValue(undefined),
			onTickMessage: jest.fn().mockResolvedValue(undefined),
		};
		await queue2.subscribe(playId, queueCallback2);
		await wait(200);
		// 再びキューは空
		await expect(queue.hasMessage(playId)).resolves.toBe(false);
		// queueを削除しようとする(ここではエラーにもならず、消えない)
		await queue.unsubscribe(playId);
		await queue.deleteQueue(playId);
		await expect(queue.hasMessage(playId)).resolves.toBe(false);
		// もう一つのキューも削除しようとする(全部のワーカがいないので消える)
		await queue2.unsubscribe(playId);
		await queue2.deleteQueue(playId);
		await expect(queue.hasMessage(playId)).resolves.toBe(null);

		// 終了処理
		await publisher.stop();
		await queue.stop();
		await queue2.stop();
		await amqpChannel.stop();
		await amqpManager.close();
	});
});
