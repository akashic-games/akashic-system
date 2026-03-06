// tslint:disable max-classes-per-file
import "jest";
import { AmqpChannelHolder, AmqpConnectionManager } from "@akashic/amqp-utils";
import { S3Client } from "@aws-sdk/client-s3";
import config from "config";
import { MongoClient } from "mongodb";
import { createPool } from "mysql";
import { encodeStartPoint, encodeTick, decodeTick } from "@akashic/amflow-message";
import { Constants } from "@akashic/server-engine-data-types";
import { LogLevel, TestLogger } from "@akashic-system/logger";
import { EventCode, EventFlagsMask, TickIndex } from "@akashic/playlog";
import {
	AMQPPlaylogPublisher,
	AMQPPlaylogStoreQueue,
	getPlayIdKey,
	MongoDBStore,
	PlayDatabase,
	playlogCollectionName,
	PlaylogDatabase,
	PlaylogMetadataMongoDBStore,
	PlaylogQueueConsumer,
	PlaylogS3Store,
	PlaylogStoreFacade,
	startPointCollectionName,
} from "../";

import type { StartPoint } from "@akashic/amflow";
import type { Tick } from "@akashic/playlog";
import type { TickRecord, StartPointRecord, DeadLetterQueueCallback, PlaylogEntity } from "../";

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("PlaylogQueueConsumer", () => {
	// 定数
	const tick1: Tick = [1];
	const tick1WithIgnorableEvent: Tick = [1, [[EventCode.Message, EventFlagsMask.Ignorable, null]]];
	const tick1WithTransientEvent: Tick = [
		1,
		[
			[EventCode.Message, EventFlagsMask.Transient, null],
			[EventCode.Message, 0, null],
		],
	];
	const tick1WithoutTransientEvent: Tick = [1, [[EventCode.Message, 0, null]]];
	const startPoint1: StartPoint = {
		frame: 1,
		timestamp: 12345678,
		data: "data",
	};

	test("PlaylogQueueConsumerはstartするとpublishされたtickやstartPointを自動で購読し保存する(正常系のテスト)", async () => {
		const playId = "1";
		// S3
		const { accessKeyId, secretAccessKey, ...rest } = config.get<{ accessKeyId?: string; secretAccessKey?: string; endpoint?: string }>(
			"s3",
		);
		const s3 = new S3Client({
			credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
			...rest,
			forcePathStyle: true,
			region: "ap-northeast-1",
		});

		// AMQPChannelHolder  AMQPPlaylogStoreQueueにも使うけれど、publisher にも使う
		const amqpManager = new AmqpConnectionManager({
			urls: config.get("rabbitmq.url"),
		});
		await amqpManager.init();
		const amqpChannelHolder = new AmqpChannelHolder(amqpManager);

		// テスト対象である PlaylogQueueConsumer を使うのに必要なものを初期化
		// consumer に必要なもの ３：PlaylogDatabase ４：PlayDatabase
		//     1, 2 は 3, 4 に依存してるので、順番が逆になる
		const mysqlConfig = config.get<{ host: string; port: number }[]>("dbSettings.database.hosts");
		const pool = createPool({
			host: mysqlConfig[0].host,
			port: mysqlConfig[0].port,
			user: config.get("dbSettings.database.user"),
			password: config.get("dbSettings.database.password"),
			database: config.get("dbSettings.database.database"),
			supportBigNumbers: true,
			bigNumberStrings: true,
			charset: "utf8mb4",
			stringifyObjects: true,
		});
		const database = new PlaylogDatabase(pool);
		await database.setPlaying(playId);
		const playDatabase = new PlayDatabase(pool);
		// consumer に必要なもの １：PlaylogStoreFacade
		// MongoClient は Teardown にも使う
		const mongoClient = await MongoClient.connect(config.get("mongodb.url"));
		const mongoDB = mongoClient.db("akashic_test");
		const mongoDBStore = new MongoDBStore(mongoDB);
		const s3Store = new PlaylogS3Store(s3, { bucket: "akashic-test" });
		const metadataStore = new PlaylogMetadataMongoDBStore(mongoDB);
		const store = new PlaylogStoreFacade({
			activeStore: mongoDBStore,
			archiveStore: s3Store,
			metadataStore,
			lock: database,
		});
		// consumer に必要なもの ２：AMQPPlaylogStoreQueue
		const queue = new AMQPPlaylogStoreQueue(amqpChannelHolder);

		// consumer （テスト対象）を作って動かす
		let current = new Date("2020-11-09T12:00:00+09:00");
		const consumer = new (class extends PlaylogQueueConsumer {
			// テスト用で外からアクセスするため
			public async onUpdate(): Promise<void> {
				return super.onUpdate();
			}
			protected getNow(): Date {
				return current;
			}
		})(store, queue, database, playDatabase);
		await consumer.start();

		// publisher
		const publisher = new AMQPPlaylogPublisher(amqpChannelHolder);
		await publisher.start();
		await publisher.prepare(playId);

		// publish する前なので、なにもとれない
		// StartPoint
		const startPointCollection = mongoDB.collection<StartPointRecord>(startPointCollectionName);
		const result1 = await startPointCollection.findOne({ playId });
		expect(result1).toBeNull();
		// Tick
		const tickCollection = mongoDB.collection<TickRecord>(playlogCollectionName);
		const result2 = await tickCollection.findOne({ playId });
		expect(result2).toBeNull();

		// publish したら、取れる
		// StartPoint
		await publisher.publishStartPoint(playId, startPoint1);
		await sleep(500);
		const result3 = await startPointCollection.findOne({ playId });
		expect(result3).not.toBeNull();
		// Tick も同様
		await publisher.publishTick(playId, tick1);
		await sleep(500);
		const result4 = await tickCollection.findOne({ playId });
		expect(result4).not.toBeNull();

		// プレーが終わった後の処理
		// 終わった直後は、まだ何もしない（内部的には各種リソースの後処理をしてる）
		await database.setClosing(playId);
		await consumer.onUpdate();
		await sleep(200);
		// まだ終了処理中なので、取れる
		// @ts-ignore
		expect(await database.getWritingPlays()).toContainEqual({ playId, writeStatus: "closing" });

		// 終了後にある程度の時間が経過したら、
		current = new Date("2020-11-09T12:10:01+09:00");
		await consumer.onUpdate();
		await sleep(200);
		// 終了処理も終わり、取れなくなる
		// @ts-ignore
		expect(await database.getWritingPlays()).not.toContainEqual({ playId, writeStatus: "closing" });
		// closed になってるものは、 writingPlays で取れない
		// @ts-ignore
		expect(await database.getWritingPlays()).not.toContainEqual({ playId, writeStatus: "closed" });

		// tear down
		await consumer.stop();
		await publisher.stop();
		await mongoClient.close();
	});

	it("startせずにstopしてもエラーは起こらない", async () => {
		// 初期化処理
		// s3に接続
		const { accessKeyId, secretAccessKey, ...rest } = config.get<{ accessKeyId?: string; secretAccessKey?: string; endpoint?: string }>(
			"s3",
		);
		const s3 = new S3Client({
			credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
			...rest,
			forcePathStyle: true,
			region: "ap-northeast-1",
		});
		// mongodbに接続
		const mongoClient = await MongoClient.connect(config.get("mongodb.url"));
		const mongoDB = mongoClient.db("akashic_test");
		// mysqlに接続
		const mysqlConfig = config.get<{ host: string; port: number }[]>("dbSettings.database.hosts");
		const pool = createPool({
			host: mysqlConfig[0].host,
			port: mysqlConfig[0].port,
			user: config.get("dbSettings.database.user"),
			password: config.get("dbSettings.database.password"),
			database: config.get("dbSettings.database.database"),
			supportBigNumbers: true,
			bigNumberStrings: true,
			charset: "utf8mb4",
			stringifyObjects: true,
		});
		// AMQPに接続
		const amqpManager = new AmqpConnectionManager({
			urls: config.get("rabbitmq.url"),
		});
		await amqpManager.init();
		const amqpChannelHolder = new AmqpChannelHolder(amqpManager);
		// オブジェクトの組み立て
		const queue = new AMQPPlaylogStoreQueue(amqpChannelHolder);
		await queue.start();
		const playlogDatabase = new PlaylogDatabase(pool);
		const playDatabase = new PlayDatabase(pool);
		const mongoDBStore = new MongoDBStore(mongoDB);
		const s3Store = new PlaylogS3Store(s3, { bucket: "akashic-test" });
		const metadataStore = new PlaylogMetadataMongoDBStore(mongoDB);
		const store = new PlaylogStoreFacade({
			activeStore: mongoDBStore,
			archiveStore: s3Store,
			metadataStore,
			lock: playlogDatabase,
		});

		// テスト
		const consumer = new PlaylogQueueConsumer(store, queue, playlogDatabase, playDatabase);
		// 終了処理
		await queue.stop();
		await consumer.stop();
	});

	it("dead-letterにデータが来ても正しく保存できることを確認", async () => {
		// 初期化処理
		const playId = "849392437293432";
		// s3に接続
		const { accessKeyId, secretAccessKey, ...rest } = config.get<{ accessKeyId?: string; secretAccessKey?: string; endpoint?: string }>(
			"s3",
		);
		const s3 = new S3Client({
			credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
			...rest,
			forcePathStyle: true,
			region: "ap-northeast-1",
		});
		// mongodbに接続
		const mongoClient = await MongoClient.connect(config.get("mongodb.url"));
		const mongoDB = mongoClient.db("akashic_test");
		// mysqlに接続
		const mysqlConfig = config.get<{ host: string; port: number }[]>("dbSettings.database.hosts");
		const pool = createPool({
			host: mysqlConfig[0].host,
			port: mysqlConfig[0].port,
			user: config.get("dbSettings.database.user"),
			password: config.get("dbSettings.database.password"),
			database: config.get("dbSettings.database.database"),
			supportBigNumbers: true,
			bigNumberStrings: true,
			charset: "utf8mb4",
			stringifyObjects: true,
		});
		// AMQPに接続
		const amqpManager = new AmqpConnectionManager({
			urls: config.get("rabbitmq.url"),
		});
		await amqpManager.init();
		const amqpChannelHolder = new AmqpChannelHolder(amqpManager);
		// オブジェクトの組み立て
		const queue = new AMQPPlaylogStoreQueue(amqpChannelHolder);
		await queue.start();
		const playlogDatabase = new PlaylogDatabase(pool);
		await playlogDatabase.setPlaying(playId);
		const playDatabase = new PlayDatabase(pool);
		const mongoDBStore = new MongoDBStore(mongoDB);
		const s3Store = new PlaylogS3Store(s3, { bucket: "akashic-test" });
		const metadataStore = new PlaylogMetadataMongoDBStore(mongoDB);
		const store = new PlaylogStoreFacade({
			activeStore: mongoDBStore,
			archiveStore: s3Store,
			metadataStore,
			lock: playlogDatabase,
		});
		// dead-letterのコールバックをmockに差し替えて参照を取得する
		const mock = jest.fn().mockResolvedValue(undefined);
		queue.subscribeDeadLetter = mock;
		const consumer = new PlaylogQueueConsumer(store, queue, playlogDatabase, playDatabase);
		await consumer.start();
		const callback = mock.mock.calls[0][0] as DeadLetterQueueCallback;

		// データが無いのを確認
		const tickCollection = mongoDB.collection<TickRecord>(playlogCollectionName);
		const startPointCollection = mongoDB.collection<StartPointRecord>(startPointCollectionName);
		const result1 = await tickCollection.findOne({ playId });
		const result2 = await startPointCollection.findOne({ playId });
		expect(result1).toBeNull();
		expect(result2).toBeNull();
		// dead-letterを取得したコールバックから送り込む
		await callback.onTickMessage(playId, tick1, encodeTick(tick1));
		await callback.onStartPointMessage(playId, startPoint1, encodeStartPoint(startPoint1));
		// 保存されているのを確認
		const result3 = await tickCollection.find({ playId }).toArray();
		const result4 = await startPointCollection.find({ playId }).toArray();
		expect(result3.length).toBe(1);
		expect(result4.length).toBe(1);

		// 終了処理
		await consumer.stop();
		await queue.stop();
		await amqpChannelHolder.stop();
		await amqpManager.close();
		await mongoClient.close();
	});

	it("dbからplaylogsを取るときにエラーが起きたらエラーイベントが出力される", async () => {
		// 初期化処理
		// s3に接続
		const { accessKeyId, secretAccessKey, ...rest } = config.get<{ accessKeyId?: string; secretAccessKey?: string; endpoint?: string }>(
			"s3",
		);
		const s3 = new S3Client({
			credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
			...rest,
			forcePathStyle: true,
			region: "ap-northeast-1",
		});
		// mongodbに接続
		const mongoClient = await MongoClient.connect(config.get("mongodb.url"));
		const mongoDB = mongoClient.db("akashic_test");
		// mysqlに接続
		const mysqlConfig = config.get<{ host: string; port: number }[]>("dbSettings.database.hosts");
		const pool = createPool({
			host: mysqlConfig[0].host,
			port: mysqlConfig[0].port,
			user: config.get("dbSettings.database.user"),
			password: config.get("dbSettings.database.password"),
			database: config.get("dbSettings.database.database"),
			supportBigNumbers: true,
			bigNumberStrings: true,
			charset: "utf8mb4",
			stringifyObjects: true,
		});
		// AMQPに接続
		const amqpManager = new AmqpConnectionManager({
			urls: config.get("rabbitmq.url"),
		});
		await amqpManager.init();
		const amqpChannelHolder = new AmqpChannelHolder(amqpManager);
		// オブジェクトの組み立て
		const queue = new AMQPPlaylogStoreQueue(amqpChannelHolder);
		await queue.start();
		const playlogDatabase = new PlaylogDatabase(pool);
		const playDatabase = new PlayDatabase(pool);
		const mongoDBStore = new MongoDBStore(mongoDB);
		const s3Store = new PlaylogS3Store(s3, { bucket: "akashic-test" });
		const metadataStore = new PlaylogMetadataMongoDBStore(mongoDB);
		const store = new PlaylogStoreFacade({
			activeStore: mongoDBStore,
			archiveStore: s3Store,
			metadataStore,
			lock: playlogDatabase,
		});
		const errorSpy = jest.fn();
		const consumer = new PlaylogQueueConsumer(store, queue, playlogDatabase, playDatabase);
		consumer.addListener("error", (err) => errorSpy(err));
		// エラーが起こるように処理を差し替え
		const mock = jest.fn().mockImplementation(async () => {
			throw new Error("test error");
		});
		playlogDatabase.getWritingPlays = mock;

		// startして1回ワーカがまわるのを待ち
		await consumer.start();
		await sleep(200);
		// エラーが正しく来ていることを確認する
		expect(errorSpy.mock.calls.length).toBe(1);
		expect(errorSpy.mock.calls[0][0].message).toBe("test error");

		// 終了処理
		await consumer.stop();
		await queue.stop();
		await amqpChannelHolder.stop();
		await amqpManager.close();
		await mongoClient.close();
	});

	it("storeTick/storeStartPointでエラーが起きたらerrorイベントが出力される", async () => {
		// 初期化処理
		const playId = "4328798472953";
		// s3に接続
		const { accessKeyId, secretAccessKey, ...rest } = config.get<{ accessKeyId?: string; secretAccessKey?: string; endpoint?: string }>(
			"s3",
		);
		const s3 = new S3Client({
			credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
			...rest,
			forcePathStyle: true,
			region: "ap-northeast-1",
		});
		// mongodbに接続
		const mongoClient = await MongoClient.connect(config.get("mongodb.url"));
		const mongoDB = mongoClient.db("akashic_test");
		// mysqlに接続
		const mysqlConfig = config.get<{ host: string; port: number }[]>("dbSettings.database.hosts");
		const pool = createPool({
			host: mysqlConfig[0].host,
			port: mysqlConfig[0].port,
			user: config.get("dbSettings.database.user"),
			password: config.get("dbSettings.database.password"),
			database: config.get("dbSettings.database.database"),
			supportBigNumbers: true,
			bigNumberStrings: true,
			charset: "utf8mb4",
			stringifyObjects: true,
		});
		// AMQPに接続
		const amqpManager = new AmqpConnectionManager({
			urls: config.get("rabbitmq.url"),
		});
		await amqpManager.init();
		const amqpChannelHolder = new AmqpChannelHolder(amqpManager);
		// オブジェクトの組み立て
		const queue = new AMQPPlaylogStoreQueue(amqpChannelHolder);
		await queue.start();
		const playlogDatabase = new PlaylogDatabase(pool);
		await playlogDatabase.setPlaying(playId);
		const playDatabase = new PlayDatabase(pool);
		const mongoDBStore = new MongoDBStore(mongoDB);
		const s3Store = new PlaylogS3Store(s3, { bucket: "akashic-test" });
		const metadataStore = new PlaylogMetadataMongoDBStore(mongoDB);
		const store = new PlaylogStoreFacade({
			activeStore: mongoDBStore,
			archiveStore: s3Store,
			metadataStore,
			lock: playlogDatabase,
		});
		const publisher = new AMQPPlaylogPublisher(amqpChannelHolder);
		await publisher.start();
		await publisher.prepare(playId);
		// storeの処理をエラーが出る処理に差し替える
		const mock = jest.fn().mockImplementation(async () => {
			throw new Error("test error");
		});
		store.putStartPoint = mock;
		store.putTick = mock;
		// consumerを作成し、エラーにハンドラを仕掛ける
		const consumer = new PlaylogQueueConsumer(store, queue, playlogDatabase, playDatabase);
		const errorSpy = jest.fn();
		consumer.addListener("error", (err) => errorSpy(err));
		await consumer.start();

		// tickとstartPointをpublisher経由でpublishする
		await publisher.publishStartPoint(playId, startPoint1);
		await publisher.publishTick(playId, tick1);
		// AMQP処理待ち
		await sleep(200);
		// エラーが正しく来ていることを確認する
		expect(errorSpy.mock.calls.length).toBe(3); // ignorableイベントを分けて保存するので、2回保存だが合計三回エラーがでる
		expect(errorSpy.mock.calls[0][0].message).toBe("test error");
		expect(errorSpy.mock.calls[1][0].message).toBe("test error");

		// 終了処理
		await consumer.stop();
		await publisher.stop();
		await queue.stop();
		await amqpChannelHolder.stop();
		await amqpManager.close();
		await mongoClient.close();
	});

	it("遅延したtick/startPointが来たらログにwarnが出力される", async () => {
		// 初期化処理
		const playId = "4328798472954";
		// s3に接続
		const { accessKeyId, secretAccessKey, ...rest } = config.get<{ accessKeyId?: string; secretAccessKey?: string; endpoint?: string }>(
			"s3",
		);
		const s3 = new S3Client({
			credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
			...rest,
			forcePathStyle: true,
			region: "ap-northeast-1",
		});
		// mongodbに接続
		const mongoClient = await MongoClient.connect(config.get("mongodb.url"));
		const mongoDB = mongoClient.db("akashic_test");
		// mysqlに接続
		const mysqlConfig = config.get<{ host: string; port: number }[]>("dbSettings.database.hosts");
		const pool = createPool({
			host: mysqlConfig[0].host,
			port: mysqlConfig[0].port,
			user: config.get("dbSettings.database.user"),
			password: config.get("dbSettings.database.password"),
			database: config.get("dbSettings.database.database"),
			supportBigNumbers: true,
			bigNumberStrings: true,
			charset: "utf8mb4",
			stringifyObjects: true,
		});
		// AMQPに接続
		const amqpManager = new AmqpConnectionManager({
			urls: config.get("rabbitmq.url"),
		});
		await amqpManager.init();
		const amqpChannelHolder = new AmqpChannelHolder(amqpManager);
		// オブジェクトの組み立て
		const queue = new AMQPPlaylogStoreQueue(amqpChannelHolder);
		await queue.start();
		const playlogDatabase = new PlaylogDatabase(pool);
		await playlogDatabase.setPlaying(playId);
		const playDatabase = new PlayDatabase(pool);
		const mongoDBStore = new MongoDBStore(mongoDB);
		const s3Store = new PlaylogS3Store(s3, { bucket: "akashic-test" });
		const metadataStore = new PlaylogMetadataMongoDBStore(mongoDB);
		const store = new PlaylogStoreFacade({
			activeStore: mongoDBStore,
			archiveStore: s3Store,
			metadataStore,
			lock: playlogDatabase,
		});
		const publisher = new AMQPPlaylogPublisher(amqpChannelHolder);
		await publisher.start();
		await publisher.prepare(playId);
		// レコード挿入
		const sqlString = `
			INSERT INTO plays (id, gameCode, started, status)
			VALUES (?, '', '2020-11-09 11:59:54', ?) ON DUPLICATE KEY UPDATE started = '2020-11-09 11:59:54', status = ?
		`;
		await new Promise<void>((resolve, reject) =>
			pool.query(sqlString, [playId, Constants.PLAY_STATE_RUNNING, Constants.PLAY_STATE_RUNNING], (err) => (err ? reject(err) : resolve())),
		);
		const consumer = new (class extends PlaylogQueueConsumer {
			protected getNow(): Date {
				return new Date("2020-11-09T12:00:00+09:00");
			}
		})(store, queue, playlogDatabase, playDatabase);
		const loggerSpy = new TestLogger();
		consumer.logger = loggerSpy;
		await consumer.start();

		// tickとstartPointをpublisher経由でpublishする
		await publisher.publishStartPoint(playId, startPoint1);
		await publisher.publishTick(playId, tick1);
		// AMQP処理待ち
		await sleep(200);
		// 保存されているのを確認
		const tickCollection = mongoDB.collection<TickRecord>(playlogCollectionName);
		const startPointCollection = mongoDB.collection<StartPointRecord>(startPointCollectionName);
		const result3 = await tickCollection.find({ playId }).toArray();
		const result4 = await startPointCollection.find({ playId }).toArray();
		expect(result3.length).toBe(1);
		expect(result4.length).toBe(1);
		// warnが呼ばれているのも確認
		expect(loggerSpy.records.filter((record) => record.level === LogLevel.WARN).length).toBe(2);
		expect(loggerSpy.records.filter((record) => record.level === LogLevel.ERROR).length).toBe(0);

		// 終了処理
		await consumer.stop();
		await publisher.stop();
		await queue.stop();
		await amqpChannelHolder.stop();
		await amqpManager.close();
		await mongoClient.close();
	});

	it("遅延したtick/startPointが来てもloggerがセットされてなければ正常系と同じ動作をする", async () => {
		// 初期化処理
		const playId = "4328798472955";
		// s3に接続
		const { accessKeyId, secretAccessKey, ...rest } = config.get<{ accessKeyId?: string; secretAccessKey?: string; endpoint?: string }>(
			"s3",
		);
		const s3 = new S3Client({
			credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
			...rest,
			forcePathStyle: true,
			region: "ap-northeast-1",
		});
		// mongodbに接続
		const mongoClient = await MongoClient.connect(config.get("mongodb.url"));
		const mongoDB = mongoClient.db("akashic_test");
		// mysqlに接続
		const mysqlConfig = config.get<{ host: string; port: number }[]>("dbSettings.database.hosts");
		const pool = createPool({
			host: mysqlConfig[0].host,
			port: mysqlConfig[0].port,
			user: config.get("dbSettings.database.user"),
			password: config.get("dbSettings.database.password"),
			database: config.get("dbSettings.database.database"),
			supportBigNumbers: true,
			bigNumberStrings: true,
			charset: "utf8mb4",
			stringifyObjects: true,
		});
		// AMQPに接続
		const amqpManager = new AmqpConnectionManager({
			urls: config.get("rabbitmq.url"),
		});
		await amqpManager.init();
		const amqpChannelHolder = new AmqpChannelHolder(amqpManager);
		// オブジェクトの組み立て
		const queue = new AMQPPlaylogStoreQueue(amqpChannelHolder);
		await queue.start();
		const playlogDatabase = new PlaylogDatabase(pool);
		await playlogDatabase.setPlaying(playId);
		const playDatabase = new PlayDatabase(pool);
		const mongoDBStore = new MongoDBStore(mongoDB);
		const s3Store = new PlaylogS3Store(s3, { bucket: "akashic-test" });
		const metadataStore = new PlaylogMetadataMongoDBStore(mongoDB);
		const store = new PlaylogStoreFacade({
			activeStore: mongoDBStore,
			archiveStore: s3Store,
			metadataStore,
			lock: playlogDatabase,
		});
		const publisher = new AMQPPlaylogPublisher(amqpChannelHolder);
		await publisher.start();
		await publisher.prepare(playId);
		// レコード挿入
		const sqlString = `
			INSERT INTO plays (id, gameCode, started, status)
			VALUES (?, '', '2020-11-09 11:59:54', ?) ON DUPLICATE KEY UPDATE started = '2020-11-09 11:59:54', status = ?
		`;
		await new Promise<void>((resolve, reject) =>
			pool.query(sqlString, [playId, Constants.PLAY_STATE_RUNNING, Constants.PLAY_STATE_RUNNING], (err) => (err ? reject(err) : resolve())),
		);
		const consumer = new (class extends PlaylogQueueConsumer {
			protected getNow(): Date {
				return new Date("2020-11-09T12:00:00+09:00");
			}
		})(store, queue, playlogDatabase, playDatabase);
		await consumer.start();

		// tickとstartPointをpublisher経由でpublishする
		await publisher.publishStartPoint(playId, startPoint1);
		await publisher.publishTick(playId, tick1);
		// AMQP処理待ち
		await sleep(200);
		// 保存されているのを確認
		const tickCollection = mongoDB.collection<TickRecord>(playlogCollectionName);
		const startPointCollection = mongoDB.collection<StartPointRecord>(startPointCollectionName);
		const result3 = await tickCollection.find({ playId }).toArray();
		const result4 = await startPointCollection.find({ playId }).toArray();
		expect(result3.length).toBe(1);
		expect(result4.length).toBe(1);

		// 終了処理
		await consumer.stop();
		await publisher.stop();
		await queue.stop();
		await amqpChannelHolder.stop();
		await amqpManager.close();
		await mongoClient.close();
	});

	it("とても遅延したtick/startPointが来たらログにerrorが出力される", async () => {
		// 初期化処理
		const playId = "4328798472956";
		// s3に接続
		const { accessKeyId, secretAccessKey, ...rest } = config.get<{ accessKeyId?: string; secretAccessKey?: string; endpoint?: string }>(
			"s3",
		);
		const s3 = new S3Client({
			credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
			...rest,
			forcePathStyle: true,
			region: "ap-northeast-1",
		});
		// mongodbに接続
		const mongoClient = await MongoClient.connect(config.get("mongodb.url"));
		const mongoDB = mongoClient.db("akashic_test");
		// mysqlに接続
		const mysqlConfig = config.get<{ host: string; port: number }[]>("dbSettings.database.hosts");
		const pool = createPool({
			host: mysqlConfig[0].host,
			port: mysqlConfig[0].port,
			user: config.get("dbSettings.database.user"),
			password: config.get("dbSettings.database.password"),
			database: config.get("dbSettings.database.database"),
			supportBigNumbers: true,
			bigNumberStrings: true,
			charset: "utf8mb4",
			stringifyObjects: true,
		});
		// AMQPに接続
		const amqpManager = new AmqpConnectionManager({
			urls: config.get("rabbitmq.url"),
		});
		await amqpManager.init();
		const amqpChannelHolder = new AmqpChannelHolder(amqpManager);
		// オブジェクトの組み立て
		const queue = new AMQPPlaylogStoreQueue(amqpChannelHolder);
		await queue.start();
		const playlogDatabase = new PlaylogDatabase(pool);
		await playlogDatabase.setPlaying(playId);
		const playDatabase = new PlayDatabase(pool);
		const mongoDBStore = new MongoDBStore(mongoDB);
		const s3Store = new PlaylogS3Store(s3, { bucket: "akashic-test" });
		const metadataStore = new PlaylogMetadataMongoDBStore(mongoDB);
		const store = new PlaylogStoreFacade({
			activeStore: mongoDBStore,
			archiveStore: s3Store,
			metadataStore,
			lock: playlogDatabase,
		});
		const publisher = new AMQPPlaylogPublisher(amqpChannelHolder);
		await publisher.start();
		await publisher.prepare(playId);
		// レコード挿入
		const sqlString = `
			INSERT INTO plays (id, gameCode, started, status)
			VALUES (?, '', '2020-11-09 11:59:50', ?) ON DUPLICATE KEY UPDATE started='2020-11-09 11:59:50', status=?
		`;
		await new Promise<void>((resolve, reject) =>
			pool.query(sqlString, [playId, Constants.PLAY_STATE_RUNNING, Constants.PLAY_STATE_RUNNING], (err) => (err ? reject(err) : resolve())),
		);
		const consumer = new (class extends PlaylogQueueConsumer {
			protected getNow(): Date {
				return new Date("2020-11-09T12:00:00+09:00");
			}
		})(store, queue, playlogDatabase, playDatabase);
		const loggerSpy = new TestLogger();
		consumer.logger = loggerSpy;
		await consumer.start();

		// tickとstartPointをpublisher経由でpublishする
		await publisher.publishStartPoint(playId, startPoint1);
		await publisher.publishTick(playId, tick1);
		// AMQP処理待ち
		await sleep(200);
		// 保存されているのを確認
		const tickCollection = mongoDB.collection<TickRecord>(playlogCollectionName);
		const startPointCollection = mongoDB.collection<StartPointRecord>(startPointCollectionName);
		const result3 = await tickCollection.find({ playId }).toArray();
		const result4 = await startPointCollection.find({ playId }).toArray();
		expect(result3.length).toBe(1);
		expect(result4.length).toBe(1);
		// warnは呼ばれずにerrorが呼ばれていることを確認
		expect(loggerSpy.records.filter((record) => record.level === LogLevel.WARN).length).toBe(0);
		expect(loggerSpy.records.filter((record) => record.level === LogLevel.ERROR).length).toBe(2);
		// 終了処理
		await consumer.stop();
		await publisher.stop();
		await queue.stop();
		await amqpChannelHolder.stop();
		await amqpManager.close();
		await mongoClient.close();
	});

	it("とても遅延したtick/startPointが来ても、loggerがセットされてなければ正常系と同じ動作をする", async () => {
		// 初期化処理
		const playId = "4328798472957";
		// s3に接続
		const { accessKeyId, secretAccessKey, ...rest } = config.get<{ accessKeyId?: string; secretAccessKey?: string; endpoint?: string }>(
			"s3",
		);
		const s3 = new S3Client({
			credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
			...rest,
			forcePathStyle: true,
			region: "ap-northeast-1",
		});
		// mongodbに接続
		const mongoClient = await MongoClient.connect(config.get("mongodb.url"));
		const mongoDB = mongoClient.db("akashic_test");
		// mysqlに接続
		const mysqlConfig = config.get<{ host: string; port: number }[]>("dbSettings.database.hosts");
		const pool = createPool({
			host: mysqlConfig[0].host,
			port: mysqlConfig[0].port,
			user: config.get("dbSettings.database.user"),
			password: config.get("dbSettings.database.password"),
			database: config.get("dbSettings.database.database"),
			supportBigNumbers: true,
			bigNumberStrings: true,
			charset: "utf8mb4",
			stringifyObjects: true,
		});
		// AMQPに接続
		const amqpManager = new AmqpConnectionManager({
			urls: config.get("rabbitmq.url"),
		});
		await amqpManager.init();
		const amqpChannelHolder = new AmqpChannelHolder(amqpManager);
		// データの初期化
		// オブジェクトの組み立て
		const queue = new AMQPPlaylogStoreQueue(amqpChannelHolder);
		await queue.start();
		const playlogDatabase = new PlaylogDatabase(pool);
		await playlogDatabase.setPlaying(playId);
		const playDatabase = new PlayDatabase(pool);
		const mongoDBStore = new MongoDBStore(mongoDB);
		const s3Store = new PlaylogS3Store(s3, { bucket: "akashic-test" });
		const metadataStore = new PlaylogMetadataMongoDBStore(mongoDB);
		const store = new PlaylogStoreFacade({
			activeStore: mongoDBStore,
			archiveStore: s3Store,
			metadataStore,
			lock: playlogDatabase,
		});
		const publisher = new AMQPPlaylogPublisher(amqpChannelHolder);
		await publisher.start();
		await publisher.prepare(playId);
		// レコード挿入
		const sqlString = `
			INSERT INTO plays (id, gameCode, started, status)
			VALUES (?, '', '2020-11-09 11:59:50', ?) ON DUPLICATE KEY UPDATE started='2020-11-09 11:59:50', status=?
		`;
		await new Promise<void>((resolve, reject) =>
			pool.query(sqlString, [playId, Constants.PLAY_STATE_RUNNING, Constants.PLAY_STATE_RUNNING], (err) => (err ? reject(err) : resolve())),
		);
		const consumer = new (class extends PlaylogQueueConsumer {
			protected getNow(): Date {
				return new Date("2020-11-09T12:00:00+09:00");
			}
		})(store, queue, playlogDatabase, playDatabase);
		await consumer.start();

		// tickとstartPointをpublisher経由でpublishする
		await publisher.publishStartPoint(playId, startPoint1);
		await publisher.publishTick(playId, tick1);
		// AMQP処理待ち
		await sleep(200);
		// 保存されているのを確認
		const tickCollection = mongoDB.collection<TickRecord>(playlogCollectionName);
		const startPointCollection = mongoDB.collection<StartPointRecord>(startPointCollectionName);
		const result3 = await tickCollection.find({ playId }).toArray();
		const result4 = await startPointCollection.find({ playId }).toArray();
		expect(result3.length).toBe(1);
		expect(result4.length).toBe(1);

		// 終了処理
		await consumer.stop();
		await publisher.stop();
		await queue.stop();
		await amqpChannelHolder.stop();
		await amqpManager.close();
		await mongoClient.close();
	});

	it("キューにメッセージが残っている時は終了手順を踏んでもclosedにならない", async () => {
		// 初期化処理
		const playId = "4328798472958";
		// s3に接続
		const { accessKeyId, secretAccessKey, ...rest } = config.get<{ accessKeyId?: string; secretAccessKey?: string; endpoint?: string }>(
			"s3",
		);
		const s3 = new S3Client({
			credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
			...rest,
			forcePathStyle: true,
			region: "ap-northeast-1",
		});
		// mongodbに接続
		const mongoClient = await MongoClient.connect(config.get("mongodb.url"));
		const mongoDB = mongoClient.db("akashic_test");
		// mysqlに接続
		const mysqlConfig = config.get<{ host: string; port: number }[]>("dbSettings.database.hosts");
		const pool = createPool({
			host: mysqlConfig[0].host,
			port: mysqlConfig[0].port,
			user: config.get("dbSettings.database.user"),
			password: config.get("dbSettings.database.password"),
			database: config.get("dbSettings.database.database"),
			supportBigNumbers: true,
			bigNumberStrings: true,
			charset: "utf8mb4",
			stringifyObjects: true,
		});
		// AMQPに接続
		const amqpManager = new AmqpConnectionManager({
			urls: config.get("rabbitmq.url"),
		});
		await amqpManager.init();
		const amqpChannelHolder = new AmqpChannelHolder(amqpManager);
		// オブジェクトの組み立て
		const queue = new AMQPPlaylogStoreQueue(amqpChannelHolder);
		await queue.start();
		const playlogDatabase = new PlaylogDatabase(pool);
		await playlogDatabase.setPlaying(playId);
		const playDatabase = new PlayDatabase(pool);
		const mongoDBStore = new MongoDBStore(mongoDB);
		const s3Store = new PlaylogS3Store(s3, { bucket: "akashic-test" });
		const metadataStore = new PlaylogMetadataMongoDBStore(mongoDB);
		const store = new PlaylogStoreFacade({
			activeStore: mongoDBStore,
			archiveStore: s3Store,
			metadataStore,
			lock: playlogDatabase,
		});
		const publisher = new AMQPPlaylogPublisher(amqpChannelHolder);
		await publisher.start();
		await publisher.prepare(playId);
		// 常にメッセージが残っている扱いにする
		const mock = jest.fn().mockResolvedValue(true);
		queue.hasMessage = mock;
		// consumer作動させる
		let currentTime = new Date("2020-11-09T12:00:00+09:00");
		const consumer = new (class extends PlaylogQueueConsumer {
			// テスト用で外からアクセスするため
			public async onUpdate(): Promise<void> {
				return super.onUpdate();
			}
			protected getNow(): Date {
				return currentTime;
			}
		})(store, queue, playlogDatabase, playDatabase);
		await consumer.start();

		// キューの終了処理
		await playlogDatabase.setClosing(playId);
		// 時間経過でまわるワーカをprivateメソッドを無理やり呼んでワーカを回す
		await consumer.onUpdate();
		// 時間経過
		currentTime = new Date("2020-11-09T12:10:01+09:00");
		// 時間経過でまわるワーカをprivateメソッドを無理やり呼んでワーカを回す
		await consumer.onUpdate();
		// closedになってないのを確認
		const sqlString = `SELECT * FROM playlogs WHERE playId = ?`;
		const playlogRecords = await new Promise<PlaylogEntity[]>((resolve, reject) =>
			pool.query(sqlString, [playId], (err, results) => (err ? reject(err) : resolve(results))),
		);
		expect(playlogRecords[0].writeStatus).toBe("closing");
		// mockも呼ばれていることを確認
		expect(mock.mock.calls.filter((call) => call[0] === playId).length).toBe(1);

		// 終了処理
		await consumer.stop();
		await publisher.stop();
		await queue.stop();
		await amqpChannelHolder.stop();
		await amqpManager.close();
		await mongoClient.close();
	});

	it("キューにメッセージが残っている時は終了手順を踏んでもclosedにならない(Logger付き)", async () => {
		// 初期化処理
		const playId = "4328798472959";
		// s3に接続
		const { accessKeyId, secretAccessKey, ...rest } = config.get<{ accessKeyId?: string; secretAccessKey?: string; endpoint?: string }>(
			"s3",
		);
		const s3 = new S3Client({
			credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
			...rest,
			forcePathStyle: true,
			region: "ap-northeast-1",
		});
		// mongodbに接続
		const mongoClient = await MongoClient.connect(config.get("mongodb.url"));
		const mongoDB = mongoClient.db("akashic_test");
		// mysqlに接続
		const mysqlConfig = config.get<{ host: string; port: number }[]>("dbSettings.database.hosts");
		const pool = createPool({
			host: mysqlConfig[0].host,
			port: mysqlConfig[0].port,
			user: config.get("dbSettings.database.user"),
			password: config.get("dbSettings.database.password"),
			database: config.get("dbSettings.database.database"),
			supportBigNumbers: true,
			bigNumberStrings: true,
			charset: "utf8mb4",
			stringifyObjects: true,
		});
		// AMQPに接続
		const amqpManager = new AmqpConnectionManager({
			urls: config.get("rabbitmq.url"),
		});
		await amqpManager.init();
		const amqpChannelHolder = new AmqpChannelHolder(amqpManager);
		// オブジェクトの組み立て
		const queue = new AMQPPlaylogStoreQueue(amqpChannelHolder);
		await queue.start();
		const playlogDatabase = new PlaylogDatabase(pool);
		await playlogDatabase.setPlaying(playId);
		const playDatabase = new PlayDatabase(pool);
		const mongoDBStore = new MongoDBStore(mongoDB);
		const s3Store = new PlaylogS3Store(s3, { bucket: "akashic-test" });
		const metadataStore = new PlaylogMetadataMongoDBStore(mongoDB);
		const store = new PlaylogStoreFacade({
			activeStore: mongoDBStore,
			archiveStore: s3Store,
			metadataStore,
			lock: playlogDatabase,
		});
		const publisher = new AMQPPlaylogPublisher(amqpChannelHolder);
		await publisher.start();
		await publisher.prepare(playId);
		// レコード挿入
		const loggerSpy = new TestLogger();
		// 常にメッセージが残っている扱いにする
		const mock = jest.fn().mockResolvedValue(true);
		queue.hasMessage = mock;
		// consumer作動させる
		let currentTime = new Date("2020-11-09T12:00:00+09:00");
		const consumer = new (class extends PlaylogQueueConsumer {
			// テスト用で外からアクセスするため
			public async onUpdate(): Promise<void> {
				return super.onUpdate();
			}
			protected getNow(): Date {
				return currentTime;
			}
		})(store, queue, playlogDatabase, playDatabase);
		consumer.logger = loggerSpy;
		await consumer.start();

		// キューの終了処理
		await playlogDatabase.setClosing(playId);
		// 時間経過でまわるワーカをprivateメソッドを無理やり呼んでワーカを回す
		await consumer.onUpdate();
		// 時間経過
		currentTime = new Date("2020-11-09T12:10:01+09:00");
		// 時間経過でまわるワーカをprivateメソッドを無理やり呼んでワーカを回す
		await consumer.onUpdate();
		// closedになってないのを確認
		const sqlString = `SELECT * FROM playlogs WHERE playId = ?`;
		const playlogRecords = await new Promise<PlaylogEntity[]>((resolve, reject) =>
			pool.query(sqlString, [playId], (err, results) => (err ? reject(err) : resolve(results))),
		);
		expect(playlogRecords[0].writeStatus).toBe("closing");
		// mockも呼ばれていることを確認
		expect(mock.mock.calls.filter((call) => call[0] === playId).length).toBe(1);
		expect(loggerSpy.records.filter((record) => record.level === LogLevel.WARN).length).toBeGreaterThan(0);

		// 終了処理
		await consumer.stop();
		await publisher.stop();
		await queue.stop();
		await amqpChannelHolder.stop();
		await amqpManager.close();
		await mongoClient.close();
	});
	/* tslint:disable no-shadowed-variable */
	it("同じtickを2重で送信してもエラーにならない(ログに警告は出るけど)", async () => {
		// 初期化処理
		const playId = "78489479934";

		// s3に接続
		const { accessKeyId, secretAccessKey, ...rest } = config.get<{ accessKeyId?: string; secretAccessKey?: string; endpoint?: string }>(
			"s3",
		);
		const s3 = new S3Client({
			credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
			...rest,
			forcePathStyle: true,
			region: "ap-northeast-1",
		});

		// mongodbに接続
		const mongoClient = await MongoClient.connect(config.get("mongodb.url"));
		const mongoDB = mongoClient.db("akashic_test");

		// mysqlに接続
		const mysqlConfig = config.get<{ host: string; port: number }[]>("dbSettings.database.hosts");
		const pool = createPool({
			host: mysqlConfig[0].host,
			port: mysqlConfig[0].port,
			user: config.get("dbSettings.database.user"),
			password: config.get("dbSettings.database.password"),
			database: config.get("dbSettings.database.database"),
			supportBigNumbers: true,
			bigNumberStrings: true,
			charset: "utf8mb4",
			stringifyObjects: true,
		});

		// AMQPに接続
		const amqpManager = new AmqpConnectionManager({
			urls: config.get("rabbitmq.url"),
		});
		await amqpManager.init();
		const amqpChannelHolder = new AmqpChannelHolder(amqpManager);

		// AMQPPlaylogPublisherの組み立て
		const publisher = new AMQPPlaylogPublisher(amqpChannelHolder);
		await publisher.start();
		await publisher.prepare(playId);

		// PlaylogQueueConsumerの組み立て
		const queue = new AMQPPlaylogStoreQueue(amqpChannelHolder);
		await queue.start();

		const playlogDatabase = new PlaylogDatabase(pool);
		await playlogDatabase.setPlaying(playId);
		const playDatabase = new PlayDatabase(pool);

		const mongoDBStore = new MongoDBStore(mongoDB);
		const s3Store = new PlaylogS3Store(s3, { bucket: "akashic-test" });
		const metadataStore = new PlaylogMetadataMongoDBStore(mongoDB);
		const store = new PlaylogStoreFacade({
			activeStore: mongoDBStore,
			archiveStore: s3Store,
			metadataStore,
			lock: playlogDatabase,
		});

		const currentTime = new Date("2020-11-09T12:00:00+09:00");
		const consumer = new PlaylogQueueConsumer(store, queue, playlogDatabase, playDatabase);
		const tickConflictedSpy = jest.fn();
		const startPointConflictedSpy = jest.fn();
		consumer.addListener("tickConflicted", tickConflictedSpy);
		consumer.addListener("startPointConflicted", startPointConflictedSpy);
		(consumer as unknown as { getNow: () => Date }).getNow = () => currentTime;
		await consumer.start();

		// playのレコード挿入
		const sqlString = `
			INSERT INTO plays (id, gameCode, started, status)
			VALUES (?, '', '2020-11-09 11:59:59', ?) ON DUPLICATE KEY UPDATE started='2020-11-09 11:59:59', status=?
		`;
		await new Promise<void>((resolve, reject) =>
			pool.query(sqlString, [playId, Constants.PLAY_STATE_RUNNING, Constants.PLAY_STATE_RUNNING], (err) => (err ? reject(err) : resolve())),
		);

		// # テスト本体
		// publish前にデータが無いのを確認
		const tickCollection = mongoDB.collection<TickRecord>(playlogCollectionName);
		const startPointCollection = mongoDB.collection<StartPointRecord>(startPointCollectionName);
		const result1 = await tickCollection.findOne({ playId });
		const result2 = await startPointCollection.findOne({ playId });
		expect(result1).toBeNull();
		expect(result2).toBeNull();

		// tickとstartPointをpublisher経由でpublishする
		await publisher.publishStartPoint(playId, startPoint1);
		await publisher.publishTick(playId, tick1);
		// AMQP処理待ち
		await sleep(200);
		// 保存されているのを確認
		const result3 = await tickCollection.find({ playId }).toArray();
		const result4 = await startPointCollection.find({ playId }).toArray();
		expect(result3.length).toBe(1);
		expect(result4.length).toBe(1);

		// 完全に同じtickとstartpointを再publishする
		await publisher.publishStartPoint(playId, startPoint1);
		await publisher.publishTick(playId, tick1);
		// AMQP処理待ち
		await sleep(200);
		// conflictedイベントは発生していないことを確認
		expect(tickConflictedSpy.mock.calls.length).toBe(0);
		expect(startPointConflictedSpy.mock.calls.length).toBe(0);

		// loggerをセット
		const loggerSpy = new TestLogger();
		consumer.logger = loggerSpy;

		// もう一度同じフレームをpublishする
		await publisher.publishStartPoint(playId, startPoint1);
		await publisher.publishTick(playId, tick1);
		// AMQP処理待ち
		await sleep(200);
		// conflictedは出てないのを確認(loggerは出ているのを確認)
		expect(tickConflictedSpy.mock.calls.length).toBe(0);
		expect(startPointConflictedSpy.mock.calls.length).toBe(0);
		expect(loggerSpy.hasRecords(LogLevel.WARN)).toBe(true);

		// 終了処理
		await consumer.stop();
		await publisher.stop();
		await queue.stop();
		await amqpChannelHolder.stop();
		await amqpManager.close();
		await mongoClient.close();
	});

	it("同じフレームの違うtickを2重送信すると、conflictイベントが飛ぶ", async () => {
		// 初期化処理
		const playId = "78489479034";

		// s3に接続
		const { accessKeyId, secretAccessKey, ...rest } = config.get<{ accessKeyId?: string; secretAccessKey?: string; endpoint?: string }>(
			"s3",
		);
		const s3 = new S3Client({
			credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
			...rest,
			forcePathStyle: true,
			region: "ap-northeast-1",
		});

		// mongodbに接続
		const mongoClient = await MongoClient.connect(config.get("mongodb.url"));
		const mongoDB = mongoClient.db("akashic_test");

		// mysqlに接続
		const mysqlConfig = config.get<{ host: string; port: number }[]>("dbSettings.database.hosts");
		const pool = createPool({
			host: mysqlConfig[0].host,
			port: mysqlConfig[0].port,
			user: config.get("dbSettings.database.user"),
			password: config.get("dbSettings.database.password"),
			database: config.get("dbSettings.database.database"),
			supportBigNumbers: true,
			bigNumberStrings: true,
			charset: "utf8mb4",
			stringifyObjects: true,
		});

		// AMQPに接続
		const amqpManager = new AmqpConnectionManager({
			urls: config.get("rabbitmq.url"),
		});
		await amqpManager.init();
		const amqpChannelHolder = new AmqpChannelHolder(amqpManager);

		// AMQPPlaylogPublisherの組み立て
		const publisher = new AMQPPlaylogPublisher(amqpChannelHolder);
		await publisher.start();
		await publisher.prepare(playId);

		// PlaylogQueueConsumerの組み立て
		const queue = new AMQPPlaylogStoreQueue(amqpChannelHolder);
		await queue.start();

		const playlogDatabase = new PlaylogDatabase(pool);
		await playlogDatabase.setPlaying(playId);
		const playDatabase = new PlayDatabase(pool);

		const mongoDBStore = new MongoDBStore(mongoDB);
		const s3Store = new PlaylogS3Store(s3, { bucket: "akashic-test" });
		const metadataStore = new PlaylogMetadataMongoDBStore(mongoDB);
		const store = new PlaylogStoreFacade({
			activeStore: mongoDBStore,
			archiveStore: s3Store,
			metadataStore,
			lock: playlogDatabase,
		});

		// オブジェクトの組み立て
		const currentTime = new Date("2020-11-09T12:00:00+09:00");
		const consumer = new PlaylogQueueConsumer(store, queue, playlogDatabase, playDatabase);
		const tickConflictedSpy = jest.fn();
		const startPointConflictedSpy = jest.fn();
		consumer.addListener("tickConflicted", tickConflictedSpy);
		consumer.addListener("startPointConflicted", startPointConflictedSpy);
		(consumer as unknown as { getNow: () => Date }).getNow = () => currentTime;
		await consumer.start();

		// playのレコード挿入
		const sqlString = `
			INSERT INTO plays (id, gameCode, started, status)
			VALUES (?, '', '2020-11-09 11:59:59', ?) ON DUPLICATE KEY UPDATE started='2020-11-09 11:59:59', status=?
		`;
		await new Promise<void>((resolve, reject) =>
			pool.query(sqlString, [playId, Constants.PLAY_STATE_RUNNING, Constants.PLAY_STATE_RUNNING], (err) => (err ? reject(err) : resolve())),
		);

		// # test本体
		// publish前にデータが無いのを確認
		const tickCollection = mongoDB.collection<TickRecord>(playlogCollectionName);
		const startPointCollection = mongoDB.collection<StartPointRecord>(startPointCollectionName);
		const result1 = await tickCollection.findOne({ playId });
		const result2 = await startPointCollection.findOne({ playId });
		expect(result1).toBeNull();
		expect(result2).toBeNull();

		// tickとstartPointをpublisher経由でpublishする
		await publisher.publishStartPoint(playId, startPoint1);
		await publisher.publishTick(playId, tick1);
		// AMQP処理待ち
		await sleep(200);
		// 保存されているのを確認
		const result3 = await tickCollection.find({ playId }).toArray();
		const result4 = await startPointCollection.find({ playId }).toArray();
		expect(result3.length).toBe(1);
		expect(result4.length).toBe(1);

		// 同じフレームだが、中身が違うtickとstartpointをpublishする
		const modifiedTick: Tick = [tick1[0], [[0, 1, null]]];
		const modifiedStartPoint = { ...startPoint1, data: "hogehoge" };
		await publisher.publishStartPoint(playId, modifiedStartPoint);
		await publisher.publishTick(playId, modifiedTick);
		// AMQP処理待ち
		await sleep(200);
		// conflictedイベントが出ているのを確認
		expect(tickConflictedSpy.mock.calls.length).toBe(2);
		expect(startPointConflictedSpy.mock.calls.length).toBe(1);
		// その引数も正しく最初のtickと変更後のtickになっていることを確認
		expect(tickConflictedSpy.mock.calls[0][0]).toEqual({
			playId,
			receivedTick: modifiedTick,
			storedTick: tick1,
		});
		expect(startPointConflictedSpy.mock.calls[0][0]).toEqual({
			playId,
			receivedStartPoint: modifiedStartPoint,
			storedStartPoint: startPoint1,
		});

		// 終了処理
		await consumer.stop();
		await publisher.stop();
		await queue.stop();
		await amqpChannelHolder.stop();
		await amqpManager.close();
		await mongoClient.close();
	});

	it("ignorableEventが付いたtickが正しく保存できる", async () => {
		// 初期化処理
		const playId = "78489479035";

		// s3に接続
		const { accessKeyId, secretAccessKey, ...rest } = config.get<{ accessKeyId?: string; secretAccessKey?: string; endpoint?: string }>(
			"s3",
		);
		const s3 = new S3Client({
			credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
			...rest,
			forcePathStyle: true,
			region: "ap-northeast-1",
		});

		// mongodbに接続
		const mongoClient = await MongoClient.connect(config.get("mongodb.url"));
		const mongoDB = mongoClient.db("akashic_test");

		// mysqlに接続
		const mysqlConfig = config.get<{ host: string; port: number }[]>("dbSettings.database.hosts");
		const pool = createPool({
			host: mysqlConfig[0].host,
			port: mysqlConfig[0].port,
			user: config.get("dbSettings.database.user"),
			password: config.get("dbSettings.database.password"),
			database: config.get("dbSettings.database.database"),
			supportBigNumbers: true,
			bigNumberStrings: true,
			charset: "utf8mb4",
			stringifyObjects: true,
		});

		// AMQPに接続
		const amqpManager = new AmqpConnectionManager({
			urls: config.get("rabbitmq.url"),
		});
		await amqpManager.init();
		const amqpChannelHolder = new AmqpChannelHolder(amqpManager);

		// AMQPPlaylogPublisherの組み立て
		const publisher = new AMQPPlaylogPublisher(amqpChannelHolder);
		await publisher.start();
		await publisher.prepare(playId);

		// PlaylogQueueConsumerの組み立て
		const queue = new AMQPPlaylogStoreQueue(amqpChannelHolder);
		await queue.start();

		const playlogDatabase = new PlaylogDatabase(pool);
		await playlogDatabase.setPlaying(playId);
		const playDatabase = new PlayDatabase(pool);

		const mongoDBStore = new MongoDBStore(mongoDB);
		const s3Store = new PlaylogS3Store(s3, { bucket: "akashic-test" });
		const metadataStore = new PlaylogMetadataMongoDBStore(mongoDB);
		const store = new PlaylogStoreFacade({
			activeStore: mongoDBStore,
			archiveStore: s3Store,
			metadataStore,
			lock: playlogDatabase,
		});

		// オブジェクトの組み立て
		const consumer = new PlaylogQueueConsumer(store, queue, playlogDatabase, playDatabase);
		await consumer.start();

		// playのレコード挿入
		const sqlString = `
			INSERT INTO plays (id, gameCode, started, status)
			VALUES (?, '', '2020-11-09 11:59:59', ?) ON DUPLICATE KEY UPDATE started='2020-11-09 11:59:59', status=?
		`;
		await new Promise<void>((resolve, reject) =>
			pool.query(sqlString, [playId, Constants.PLAY_STATE_RUNNING, Constants.PLAY_STATE_RUNNING], (err) => (err ? reject(err) : resolve())),
		);

		// # test本体
		// publish前にデータが無いのを確認
		const tickCollection = mongoDB.collection<TickRecord>(playlogCollectionName);
		const result1 = await tickCollection.findOne({ playId });
		const result2 = await tickCollection.findOne({ playId: getPlayIdKey(playId, { ignorable: true }) });
		expect(result1).toBeNull();
		expect(result2).toBeNull();

		// ignorableイベント付きtickをpublisher経由でpublishする
		await publisher.publishTick(playId, tick1WithIgnorableEvent);
		// AMQP処理待ち
		await sleep(200);
		// ignorableとそうでないのの2種類に保存されているのを確認
		const result3 = await tickCollection.find({ playId }).toArray();
		const result4 = await tickCollection.find({ playId: getPlayIdKey(playId, { ignorable: true }) }).toArray();
		expect(decodeTick(Buffer.from(result3[0].data.buffer))).toEqual(tick1WithIgnorableEvent);
		expect(decodeTick(Buffer.from(result4[0].data.buffer))[TickIndex.Events]).toBeFalsy();

		// 終了処理
		await consumer.stop();
		await publisher.stop();
		await queue.stop();
		await amqpChannelHolder.stop();
		await amqpManager.close();
		await mongoClient.close();
	});

	it("transientEventが付いたtickはtransientイベントが除去されて保存される", async () => {
		// 初期化処理
		const playId = "78489479036";

		// s3に接続
		const { accessKeyId, secretAccessKey, ...rest } = config.get<{ accessKeyId?: string; secretAccessKey?: string; endpoint?: string }>(
			"s3",
		);
		const s3 = new S3Client({
			credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
			...rest,
			forcePathStyle: true,
			region: "ap-northeast-1",
		});

		// mongodbに接続
		const mongoClient = await MongoClient.connect(config.get("mongodb.url"));
		const mongoDB = mongoClient.db("akashic_test");

		// mysqlに接続
		const mysqlConfig = config.get<{ host: string; port: number }[]>("dbSettings.database.hosts");
		const pool = createPool({
			host: mysqlConfig[0].host,
			port: mysqlConfig[0].port,
			user: config.get("dbSettings.database.user"),
			password: config.get("dbSettings.database.password"),
			database: config.get("dbSettings.database.database"),
			supportBigNumbers: true,
			bigNumberStrings: true,
			charset: "utf8mb4",
			stringifyObjects: true,
		});

		// AMQPに接続
		const amqpManager = new AmqpConnectionManager({
			urls: config.get("rabbitmq.url"),
		});
		await amqpManager.init();
		const amqpChannelHolder = new AmqpChannelHolder(amqpManager);

		// AMQPPlaylogPublisherの組み立て
		const publisher = new AMQPPlaylogPublisher(amqpChannelHolder);
		await publisher.start();
		await publisher.prepare(playId);

		// PlaylogQueueConsumerの組み立て
		const queue = new AMQPPlaylogStoreQueue(amqpChannelHolder);
		await queue.start();

		const playlogDatabase = new PlaylogDatabase(pool);
		await playlogDatabase.setPlaying(playId);
		const playDatabase = new PlayDatabase(pool);

		const mongoDBStore = new MongoDBStore(mongoDB);
		const s3Store = new PlaylogS3Store(s3, { bucket: "akashic-test" });
		const metadataStore = new PlaylogMetadataMongoDBStore(mongoDB);
		const store = new PlaylogStoreFacade({
			activeStore: mongoDBStore,
			archiveStore: s3Store,
			metadataStore,
			lock: playlogDatabase,
		});

		// オブジェクトの組み立て
		const consumer = new PlaylogQueueConsumer(store, queue, playlogDatabase, playDatabase);
		await consumer.start();

		// playのレコード挿入
		const sqlString = `
			INSERT INTO plays (id, gameCode, started, status)
			VALUES (?, '', '2020-11-09 11:59:59', ?) ON DUPLICATE KEY UPDATE started='2020-11-09 11:59:59', status=?
		`;
		await new Promise<void>((resolve, reject) =>
			pool.query(sqlString, [playId, Constants.PLAY_STATE_RUNNING, Constants.PLAY_STATE_RUNNING], (err) => (err ? reject(err) : resolve())),
		);

		// # test本体
		// publish前にデータが無いのを確認
		const tickCollection = mongoDB.collection<TickRecord>(playlogCollectionName);
		const result1 = await tickCollection.findOne({ playId });
		const result2 = await tickCollection.findOne({ playId: getPlayIdKey(playId, { ignorable: true }) });
		expect(result1).toBeNull();
		expect(result2).toBeNull();

		// transientイベント付きtickをpublisher経由でpublishする
		await publisher.publishTick(playId, tick1WithTransientEvent);
		// AMQP処理待ち
		await sleep(200);
		// transientイベントが除外されて保存されているのを確認
		const result3 = await tickCollection.find({ playId }).toArray();
		expect(decodeTick(Buffer.from(result3[0].data.buffer))).toEqual(tick1WithoutTransientEvent);

		// 終了処理
		await consumer.stop();
		await publisher.stop();
		await queue.stop();
		await amqpChannelHolder.stop();
		await amqpManager.close();
		await mongoClient.close();
	});
	/* tslint:enable no-shadowed-variable */
});
