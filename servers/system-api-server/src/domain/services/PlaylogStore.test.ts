import * as activeRecord from "@akashic/akashic-active-record";
import * as amflow from "@akashic/amflow";
import * as amflowMessage from "@akashic/amflow-message";
import * as playlog from "@akashic/playlog";
import { PlaylogStoreConnection, PlaylogStoreConfig } from "./PlaylogStoreConnection";

import config from "config";
import { MongoClient, Collection, Binary } from "mongodb";
import { PlaylogStore, PlayData } from "./PlaylogStore";
import * as Mysql from "mysql";

describe("PlaylogStore", () => {
	const datastore = config.get<PlaylogStoreConfig>("datastore");
	const playId = "1";
	const frame = 0;
	const ignorablePostfix = "_ignored";
	let mongoClient: MongoClient;
	let playlogCollection: Collection;
	let startpointsCollection: Collection;
	let playlogStoreConnection: PlaylogStoreConnection;

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

	beforeAll(async () => {
		// mongo
		mongoClient = await MongoClient.connect(datastore.mongodb.url);
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
		playlogStoreConnection = new PlaylogStoreConnection(
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
		// 後始末
		await startpointsCollection.deleteMany({});
		await playlogCollection.deleteMany({});
		await mongoClient.close(true);
		await playlogStoreConnection.disconnect();
	});

	it("playlogとstartpointを取得できる", async () => {
		const playlogStore = new PlaylogStore(playlogStoreConnection);
		// テスト用のstartpointをmongoに挿入する
		const startPoint = createStartPoint();
		const startpointRaw = new Binary(amflowMessage.encodeStartPoint(startPoint));
		await startpointsCollection.insertOne({ playId, frame, startPoint: startpointRaw });

		// テスト用のplaylogをmongoに挿入する
		const tick: playlog.Tick = createTestTick();
		const tickRaw = new Binary(amflowMessage.encodeTick(tick));
		await playlogCollection.insertOne({ playId, frame, data: tickRaw });

		// tickとstartpointがplaylogとして取得できることを確認
		const playlog = await playlogStore.getPlaylogData(playId);
		const expectPlaylog: PlayData = {
			tickList: null,
			startPoints: null,
		};
		expectPlaylog.tickList = amflowMessage.fromTicks([tick]);
		expectPlaylog.startPoints = [startPoint];
		expect(playlog).toEqual(expectPlaylog);

		// ignorableなplaylogをテスト用のデータとしてmongoに挿入する
		const ignorablePlayId = playId + ignorablePostfix;
		await playlogCollection.insertOne({ playId: ignorablePlayId, frame, data: tickRaw });

		// ignorable指定でplaylogを取得する
		const ignorablePlaylog = await playlogStore.getPlaylogData(playId, { ignorable: true });
		const expectIgnorablePlaylog: PlayData = {
			tickList: null,
			startPoints: null,
		};
		expectIgnorablePlaylog.tickList = amflowMessage.fromTicks([tick]);
		expectIgnorablePlaylog.startPoints = [startPoint];
		expect(ignorablePlaylog).toEqual(expectIgnorablePlaylog);

		await startpointsCollection.deleteMany({});
		await playlogCollection.deleteMany({});
	});
});
