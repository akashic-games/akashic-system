import { S3Client, S3ClientConfig } from "@aws-sdk/client-s3";
import config from "config";
import * as log4js from "log4js";
import { MongoClient } from "mongodb";
import { createPool, PoolConfig } from "mysql";
import { context, Log4jsAppender, Logger } from "@akashic-system/logger";
import { AmqpConnectionManager, Config as AMQPConfig, AmqpChannelHolder } from "@akashic/amqp-utils";
import {
	ApplicationBase,
	PlaylogQueueConsumer,
	AMQPPlaylogStoreQueue,
	PlaylogDatabase,
	PlaylogS3Store,
	MongoDBStore,
	PlaylogMetadataMongoDBStore,
	PlaylogStoreFacade,
	PlaylogS3StoreSettings,
	PlayDatabase,
} from "@akashic/akashic-system";

class PlaylogStoreWorker extends ApplicationBase {
	private mongoDBUrl!: string;
	private mongoDBDatabaseName!: string;
	private s3Config!: S3ClientConfig;
	private amqpConfig!: AMQPConfig;
	private mysqlConfig!: PoolConfig;
	private archiveSettings!: PlaylogS3StoreSettings;
	private consumer!: PlaylogQueueConsumer;
	private logger!: Logger;
	async initialize(): Promise<ApplicationBase> {
		this.archiveSettings = config.get("archiveSettings");
		this.amqpConfig = config.get("rabbitmq");
		this.mongoDBUrl = config.get("mongodb.url");
		this.mongoDBDatabaseName = config.get("mongodb.database");
		const { accessKeyId, secretAccessKey, ...rest } = config.get<{ accessKeyId?: string; secretAccessKey?: string; endpoint?: string }>(
			"s3",
		);
		this.s3Config = {
			credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
			region: "ap-northeast-1",
			...rest,
		};
		this.mysqlConfig = config.get("mysql");
		log4js.configure(config.get("log"));
		this.logger = new Logger([new Log4jsAppender(log4js.getLogger("out"))]);

		this.status = "initialized";
		this.logger.info("initialized");
		return this;
	}
	async boot(): Promise<ApplicationBase> {
		// s3に接続
		const s3 = new S3Client(this.s3Config);

		// AMQPに接続
		const amqpManager = new AmqpConnectionManager(this.amqpConfig);
		await amqpManager.init();
		const amqpChannelHolder = new AmqpChannelHolder(amqpManager);
		amqpChannelHolder.on("error", (err) => {
			this.logger.error("AmqpChannelHolderで致命的エラーが発生しました", err);
			process.exit(1);
		});

		// mongodbに接続
		const mongoClient = await MongoClient.connect(this.mongoDBUrl);
		const mongoDB = mongoClient.db(this.mongoDBDatabaseName);

		// mysqlに接続
		const pool = createPool(this.mysqlConfig);

		const queue = new AMQPPlaylogStoreQueue(amqpChannelHolder);
		queue.on("error", (err) => {
			this.logger.error(
				"AMQPPlaylogStoreQueueで致命的エラーが発生しました",
				context({ errorMessage: (err as Error).message, stacktrace: (err as Error).stack ?? "" }),
			);
			process.exit(1);
		});
		queue.logger = this.logger;
		const playlogDatabase = new PlaylogDatabase(pool);
		// storeの構築
		const mongoDBStore = new MongoDBStore(mongoDB);
		const s3Store = new PlaylogS3Store(s3, this.archiveSettings);
		const metadataStore = new PlaylogMetadataMongoDBStore(mongoDB);
		const store = new PlaylogStoreFacade({
			activeStore: mongoDBStore,
			archiveStore: s3Store,
			metadataStore,
			lock: playlogDatabase,
		});
		const playDatabase = new PlayDatabase(pool);
		this.consumer = new PlaylogQueueConsumer(store, queue, playlogDatabase, playDatabase);
		this.consumer.logger = this.logger;
		this.consumer.on("error", (err) => {
			this.logger.error(
				"PlaylogQueueConsumerで致命的エラーが発生しました",
				context({ errorMessage: (err as Error).message, stacktrace: (err as Error).stack ?? "" }),
			);
			process.exit(1);
		});
		this.consumer.on("tickConflicted", (conflictedTick) => {
			this.logger.error(
				`保存しようとしたtickが衝突しました playId: ${conflictedTick.playId} receivedTick: ${JSON.stringify(
					conflictedTick.receivedTick,
				)} storedTick: ${JSON.stringify(conflictedTick.storedTick)}`,
			);
		});
		this.consumer.on("startPointConflicted", (conflictedStartPoint) => {
			this.logger.error(
				`保存しようとしたstartPointが衝突しました playId: ${conflictedStartPoint.playId} receivedStartPoint: ${JSON.stringify(
					conflictedStartPoint.receivedStartPoint,
				)} storedStartPoint: ${JSON.stringify(conflictedStartPoint.storedStartPoint)}`,
			);
		});

		await this.consumer.start();

		// graceful shutdown用。SIGTERM来たら終了する
		process.on("SIGTERM", async () => {
			this.logger.info("SIGTERMを受信しました");
			// 購読処理停止
			await this.consumer.stop();
			// イベントキューが十分に掃けるのを待ってから終了
			setTimeout(() => {
				this.logger.info("終了処理が終わりました。終了します");
				process.exit(0);
			}, 3000);
		});

		this.status = "running";
		this.logger.info("playlog-store-worker started");
		return this;
	}
	async terminate(): Promise<ApplicationBase> {
		await this.consumer.stop();
		this.status = "terminated";
		return this;
	}
}

async function start() {
	const app = new PlaylogStoreWorker();
	await app.initialize();
	await app.boot();
}
start();
