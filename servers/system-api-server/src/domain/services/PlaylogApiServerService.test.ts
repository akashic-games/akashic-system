import * as activeRecord from "@akashic/akashic-active-record";
import * as amflow from "@akashic/amflow";
import * as amflowMessage from "@akashic/amflow-message";
import * as playlog from "@akashic/playlog";
import * as msgpack from "msgpack-lite";
import * as Mysql from "mysql";

import { AmqpConnectionManager } from "@akashic/amqp-utils";
import * as PlaylogStore from "./PlaylogStore";
import { CopyPlaylogRequest } from "./PlayServerService";

import config from "config";
import * as PlaylogStoreConnection from "./PlaylogStoreConnection";
import PlaylogApiServerService from "./PlaylogApiServerService";
import { MongoClient, Collection, Binary } from "mongodb";

describe("PlaylogApiServerService", () => {
	const urls = config.get<string[]>("rabbitmq.url");
	const datastore = config.get<PlaylogStoreConnection.PlaylogStoreConfig>("datastore");
	const ignorablePostfix = "_ignored";
	const playId = "1";
	const ignorablePlayId = playId + ignorablePostfix;
	const frame = 0;
	let playlogStoreConnection: PlaylogStoreConnection.PlaylogStoreConnection;
	let amqpManager: AmqpConnectionManager;
	let mongoClient: MongoClient;
	let playlogCollection: Collection;
	let startpointsCollection: Collection;

	beforeAll(async () => {
		// amqp
		amqpManager = new AmqpConnectionManager({
			urls,
		});
		await amqpManager.init();

		// mongo
		mongoClient = await MongoClient.connect(datastore.mongodb!.url);
		playlogCollection = mongoClient.db().collection("playlogs");
		startpointsCollection = mongoClient.db().collection("startpoints");

		// mysql
		const databaseConfig = config.get<activeRecord.DatabaseConfig>("dbSettings.database");
		const mysqlPool = Mysql.createPool({
			host: databaseConfig.hosts[0].host,
			port: databaseConfig.hosts[0].port,
			user: databaseConfig.user,
			password: databaseConfig.password,
			database: databaseConfig.database,
			supportBigNumbers: true,
			bigNumberStrings: true,
			charset: "utf8mb4",
			stringifyObjects: true,
		});

		// PlaylogStore
		playlogStoreConnection = new PlaylogStoreConnection.PlaylogStoreConnection(
			{
				playlogStore: datastore,
				s3: config.get("s3"),
				archiveSettings: config.get("archiveSettings"),
			},
			mysqlPool,
		);
		await playlogStoreConnection.connect();
	});

	afterAll(async () => {
		await mongoClient.close(true);
		await amqpManager.close().catch((): undefined => undefined);
		await playlogStoreConnection.disconnect();
	});

	afterEach(async () => {
		await playlogCollection.deleteMany({});
		await startpointsCollection.deleteMany({});
	});

	function createTestTick(): playlog.Tick {
		const event: playlog.Event = [
			32,
			1,
			":akashic",
			{
				type: "nx:send",
				parameters: {
					type: "test_tick",
				},
			},
		];
		return [frame, event];
	}

	function createStartPoint(): amflow.StartPoint {
		return {
			frame: 0,
			timestamp: 1594270874472,
			data: {},
		};
	}

	it("playlogをコピーできる", async () => {
		// テスト用のstartpointをmongoに挿入する
		const startPoint = createStartPoint();
		const startpointRaw = new Binary(amflowMessage.encodeStartPoint(startPoint));
		await startpointsCollection.insertOne({ playId, frame, startPoint: startpointRaw });

		// テスト用のplaylogをmongoに挿入する
		const tick: playlog.Tick = createTestTick();
		const tickRaw = new Binary(amflowMessage.encodeTick(tick));
		// 通常のplaylog
		await playlogCollection.insertOne({ playId, frame, data: tickRaw });

		// playlogを別プレーにコピーする
		const playlogStore = new PlaylogStore.PlaylogStore(playlogStoreConnection);
		const playlogApiServerService = new PlaylogApiServerService(amqpManager, playlogStore);
		const copyPlayId = "2";
		const args: CopyPlaylogRequest = {
			playId,
			count: 1,
		};
		await playlogApiServerService.copyPlaylog(copyPlayId, args);

		// コピーされていることを確認
		const document = await playlogCollection.findOne({ playId });
		const copyDocument = await playlogCollection.findOne({ playId: copyPlayId });
		expect(document?.data).toEqual(copyDocument?.data);

		await playlogCollection.deleteMany({});
		await startpointsCollection.deleteMany({});
	});

	it("ignorableなplaylogも一緒にコピーできる", async () => {
		// テスト用のstartpointをmongoに挿入する
		const startPoint = createStartPoint();
		const startpointRaw = new Binary(amflowMessage.encodeStartPoint(startPoint));
		await startpointsCollection.insertOne({ playId, frame, startPoint: startpointRaw });

		// テスト用のplaylogをmongoに挿入する
		const tick: playlog.Tick = createTestTick();
		const tickRaw = new Binary(amflowMessage.encodeTick(tick));
		// 通常のplaylog
		await playlogCollection.insertOne({ playId, frame, data: tickRaw });
		// ignorableのplaylog
		await playlogCollection.insertOne({ playId: ignorablePlayId, frame, data: tickRaw });

		// 通常のplaylogと共に、ignorableなplaylogも別プレーにコピーする
		const playlogStore = new PlaylogStore.PlaylogStore(playlogStoreConnection);
		const playlogApiServerService = new PlaylogApiServerService(amqpManager, playlogStore);
		const copyPlayId = "2";
		const args: CopyPlaylogRequest = {
			playId,
			count: 1,
		};
		await playlogApiServerService.copyPlaylog(copyPlayId, args);

		// ignorableなplaylogがコピーされていることを確認
		const copyIgnorablePlayId = copyPlayId + ignorablePostfix;
		const document = await playlogCollection.findOne({ playId: ignorablePlayId });
		const copyDocument = await playlogCollection.findOne({ playId: copyIgnorablePlayId });
		expect(document?.data).toEqual(copyDocument?.data);

		await playlogCollection.deleteMany({});
		await startpointsCollection.deleteMany({});
	});

	it("引数として渡されたplaylogをコピーできる", async () => {
		// 引数として渡すplaylogデータを作る
		const tick = createTestTick();
		const startpoint = createStartPoint();
		const tickList: playlog.TickList = [0, 1, [tick]];
		const startPoints: amflow.StartPoint[] = [startpoint];
		const playlog = {
			tickList,
			startPoints,
		};
		const encodedTickList = msgpack.encode(playlog).toString("base64");

		// 作成したplaylogデータを渡して別プレーにコピーする
		const playlogStore = new PlaylogStore.PlaylogStore(playlogStoreConnection);
		const playlogApiServerService = new PlaylogApiServerService(amqpManager, playlogStore);
		const copyPlayId = "2";
		const args: CopyPlaylogRequest = {
			playData: encodedTickList,
			count: 1,
		};
		await playlogApiServerService.copyPlaylog(copyPlayId, args);

		// 引数として渡したTickがコピーされていることを確認
		const copyDocument = await playlogCollection.findOne({ playId: copyPlayId });
		const decodedTick = amflowMessage.decodeTick(copyDocument!.data.read(0, copyDocument!.data.length()));
		expect(decodedTick).toEqual(tick);

		await startpointsCollection.deleteMany({});
		await playlogCollection.deleteMany({});
	});

	it("引数として渡されたignorableなplaylogをコピーできる", async () => {
		// 引数として渡すplaylogデータを作る
		const tick = createTestTick();
		const startpoint = createStartPoint();
		const tickList: playlog.TickList = [0, 1, [tick]];
		const startPoints: amflow.StartPoint[] = [startpoint];
		const playlog = {
			tickList,
			startPoints,
		};
		const encodedTickList = msgpack.encode(playlog).toString("base64");

		// 作成したplaylogデータを通常playlog、ignorableなplaylogとしてそれぞれ渡して別プレーにコピーする
		const playlogStore = new PlaylogStore.PlaylogStore(playlogStoreConnection);
		const playlogApiServerService = new PlaylogApiServerService(amqpManager, playlogStore);
		const copyPlayId = "2";
		const args: CopyPlaylogRequest = {
			playData: encodedTickList,
			ignorablePlayData: encodedTickList,
			count: 1,
		};
		await playlogApiServerService.copyPlaylog(copyPlayId, args);

		// ignorableなplaylogとしてコピーされていることを確認
		const copyIgnorablePlayId = copyPlayId + ignorablePostfix;
		const copyDocument = await playlogCollection.findOne({ playId: copyIgnorablePlayId });
		const decodedTick = amflowMessage.decodeTick(copyDocument!.data.read(0, copyDocument!.data.length()));
		expect(decodedTick).toEqual(tick);

		await startpointsCollection.deleteMany({});
		await playlogCollection.deleteMany({});
	});

	it("指定したplaylogを取得できる", async () => {
		// テスト用のstartpointをmongoに挿入する
		const startPoint = createStartPoint();
		const startpointRaw = new Binary(amflowMessage.encodeStartPoint(startPoint));
		await startpointsCollection.insertOne({ playId, frame, startPoint: startpointRaw });
		// テスト用のplaylogをmongoに挿入する
		const tick: playlog.Tick = createTestTick();
		const tickRaw = new Binary(amflowMessage.encodeTick(tick));
		// 通常のplaylog
		await playlogCollection.insertOne({ playId, frame, data: tickRaw });

		// 指定したplayIdのplaylogを取得できる
		const playlogStore = new PlaylogStore.PlaylogStore(playlogStoreConnection);
		const playlogApiServerService = new PlaylogApiServerService(amqpManager, playlogStore);

		const result = await playlogApiServerService.getPlaylog(playId);
		const expectedPlaylog = { tickList: [0, 0, [tick]], startPoints: [startPoint] };
		expect(result).toEqual(msgpack.encode(expectedPlaylog).toString("base64"));

		await startpointsCollection.deleteMany({});
		await playlogCollection.deleteMany({});
	});

	it("ignorableを除外したplaylogを取得できる", async () => {
		// テスト用のstartpointをmongoに挿入する
		const startPoint = createStartPoint();
		const startpointRaw = new Binary(amflowMessage.encodeStartPoint(startPoint));
		await startpointsCollection.insertOne({ playId, frame, startPoint: startpointRaw });
		// テスト用のplaylogをmongoに挿入する
		const tick: playlog.Tick = createTestTick();
		const tickRaw = new Binary(amflowMessage.encodeTick(tick));
		// ignorableのplaylog
		await playlogCollection.insertOne({ playId: ignorablePlayId, frame, data: tickRaw });

		// 指定したplayIdのignorableを除外したplaylogを取得できる
		const playlogStore = new PlaylogStore.PlaylogStore(playlogStoreConnection);
		const playlogApiServerService = new PlaylogApiServerService(amqpManager, playlogStore);

		const result = await playlogApiServerService.getPlaylog(playId, { ignorable: true });
		const expectedPlaylog = { tickList: [0, 0, [tick]], startPoints: [startPoint] };
		expect(result).toEqual(msgpack.encode(expectedPlaylog).toString("base64"));

		await startpointsCollection.deleteMany({});
		await playlogCollection.deleteMany({});
	});
});
