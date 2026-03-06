import config from "config";
import { createPool } from "mysql";
import { AmqpConnectionManager, AmqpChannelHolder } from "@akashic/amqp-utils";
import { PlaylogDatabase, PlaylogEntity } from "../../../lib/Playlog";
import { PlaylogFixture } from "../PlaylogFixture";
import { AMQPPlaylogPublisher } from "../PlaylogQueue/AMQPPlaylogPublisher";
import {
	getExchangeNames,
	getQueueNames,
	tickDlxName,
	startPointDlxName,
	tickStoreDeadLetterQueueName,
	startPointStoreDeadLetterQueueName,
} from "../PlaylogQueue/constants";

describe("PlaylogFixture", () => {
	const playId1 = "11111112";
	const playId2 = "432912332031"; // 削除作業するので他と被りそうにないIDにする

	it("PlaylogFixture#preparePublishPlaylogを呼ぶことでpublish準備ができ、writeStatus==='playing'になる", async () => {
		// 初期化コード
		// AMQPに接続
		const amqpManager = new AmqpConnectionManager({
			urls: config.get("rabbitmq.url"),
		});
		await amqpManager.init();
		const amqpChannelHolder = new AmqpChannelHolder(amqpManager);

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
		const playlogDatabase = new PlaylogDatabase(pool);

		const publisher = new AMQPPlaylogPublisher(amqpChannelHolder);
		const channel = await amqpChannelHolder.getChannel();
		const fixture = new PlaylogFixture(publisher, playlogDatabase);
		// 準備する
		await fixture.preparePublishPlaylog(playId1);

		// 準備が出来ているならば以下のチェックは全部通るはず
		const { tickBroadcastExchangeName, tickStoreExchangeName, startPointStoreExchangeName, eventExchangeName } = getExchangeNames(playId1);
		const { tickStoreQueueName, startPointStoreQueueName, eventQueueName } = getQueueNames(playId1);
		await channel.checkExchange(tickBroadcastExchangeName);
		await channel.checkExchange(tickStoreExchangeName);
		await channel.checkExchange(startPointStoreExchangeName);
		await channel.checkExchange(eventExchangeName);
		await channel.checkExchange(tickDlxName);
		await channel.checkExchange(startPointDlxName);
		await channel.checkQueue(tickStoreQueueName);
		await channel.checkQueue(startPointStoreQueueName);
		await channel.checkQueue(eventQueueName);
		await channel.checkQueue(tickStoreDeadLetterQueueName);
		await channel.checkQueue(startPointStoreDeadLetterQueueName);
		const sqlString = `SELECT * FROM playlogs WHERE playId = ?`;
		const playlogRecords = await new Promise<PlaylogEntity[]>((resolve, reject) =>
			pool.query(sqlString, [playId1], (err, results) => (err ? reject(err) : resolve(results))),
		);
		expect(playlogRecords[0].writeStatus).toBe("playing");

		// 終了処理
		await publisher.stop();
		await amqpChannelHolder.stop();
		await amqpManager.close();
	});
	it("PlaylogFixturePlaylogFixture#cleanupPublishPlaylog()を呼ぶと後片付けが実施され、writeStatus==='closing'になる", async () => {
		// 初期化コード
		// AMQPに接続
		const amqpManager = new AmqpConnectionManager({
			urls: config.get("rabbitmq.url"),
		});
		await amqpManager.init();
		const amqpChannelHolder = new AmqpChannelHolder(amqpManager);

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
		const playlogDatabase = new PlaylogDatabase(pool);

		const publisher = new AMQPPlaylogPublisher(amqpChannelHolder);
		let channel = await amqpChannelHolder.getChannel();
		const fixture = new PlaylogFixture(publisher, playlogDatabase);
		// 準備する
		await fixture.preparePublishPlaylog(playId2);
		// 後片付けをする
		await fixture.cleanupPublishPlaylog(playId2);

		// 後片付けが完了しているならば以下のチェックは全部通るはず
		const { tickBroadcastExchangeName, tickStoreExchangeName, startPointStoreExchangeName, eventExchangeName } = getExchangeNames(playId2);
		const { tickStoreQueueName, startPointStoreQueueName, eventQueueName } = getQueueNames(playId2);
		// exchangeとイベントキューは消える
		await expect(channel.checkExchange(tickBroadcastExchangeName)).rejects.toThrow(/.*NOT_FOUND.*/);
		channel = await amqpChannelHolder.getChannel();
		await expect(channel.checkExchange(tickStoreExchangeName)).rejects.toThrow(/.*NOT_FOUND.*/);
		channel = await amqpChannelHolder.getChannel();
		await expect(channel.checkExchange(startPointStoreExchangeName)).rejects.toThrow(/.*NOT_FOUND.*/);
		channel = await amqpChannelHolder.getChannel();
		await expect(channel.checkExchange(eventExchangeName)).rejects.toThrow(/.*NOT_FOUND.*/);
		channel = await amqpChannelHolder.getChannel();
		await expect(channel.checkQueue(eventQueueName)).rejects.toThrow(/.*NOT_FOUND.*/);
		channel = await amqpChannelHolder.getChannel();
		// 他は残る
		await channel.checkExchange(tickDlxName);
		await channel.checkExchange(startPointDlxName);
		await channel.checkQueue(tickStoreQueueName);
		await channel.checkQueue(startPointStoreQueueName);
		await channel.checkQueue(tickStoreDeadLetterQueueName);
		await channel.checkQueue(startPointStoreDeadLetterQueueName);
		// レコードはclosingになる
		const sqlString = `SELECT * FROM playlogs WHERE playId = ?`;
		const playlogRecords2 = await new Promise<PlaylogEntity[]>((resolve, reject) =>
			pool.query(sqlString, [playId2], (err, results) => (err ? reject(err) : resolve(results))),
		);
		expect(playlogRecords2[0].writeStatus).toBe("closing");

		// 終了処理
		await publisher.stop();
		await amqpChannelHolder.stop();
		await amqpManager.close();
	});
});
