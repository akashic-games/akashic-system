import * as playlogStore from "@akashic/playlog-store";
import config from "config";
import * as mongodb from "mongodb";
import * as nock from "nock";
import MockStorageServer from "./MockStorageServer";
import { RequestHandler } from "./RequestHandler";
const PlaylogStore = playlogStore.PlaylogMongoDBStore;
const StartPointStore = playlogStore.StartPointMongoDBStore;

// CI で動かすのが困難なので、無効化
xdescribe("RequestHandler", () => {
	beforeAll((done) => {
		jasmine.DEFAULT_TIMEOUT_INTERVAL = 20 * 1000;
		const mongoUrl: string = config.get("datastore.mongodb.url");
		const dbName = config.get("datastore.mongodb.database");
		mongodb.MongoClient.connect(mongoUrl, async (error, client) => {
			if (error) {
				done.fail(error);
			}
			this.client = client;
			this.playlogStore = new PlaylogStore(this.client.db(dbName));
			this.startPointStore = new StartPointStore(this.client.db(dbName));
			try {
				await Promise.all([this.playlogStore.createTable(), this.startPointStore.createTable()]);
				done();
			} catch (error) {
				done.fail(error);
			}
		});
	});

	afterAll(async (done) => {
		await this.client.close(true, (err) => {
			if (err) {
				return done.fail(err);
			}
			done();
		});
	});

	beforeEach(async (done) => {
		this.handler = new RequestHandler(this.playlogStore, this.startPointStore);
		try {
			await Promise.all([this.playlogStore.createTable(), this.startPointStore.createTable()]);
			done();
		} catch (error) {
			done.fail(error);
		}
	});

	afterEach(async (done) => {
		nock.cleanAll();
		try {
			await Promise.all([this.playlogStore.deleteTable(), this.startPointStore.deleteTable()]);
			done();
		} catch (error) {
			done.fail(error);
		}
	});

	it("#getStorageData", async (done) => {
		new MockStorageServer().get(200, [
			{
				data: "data",
				tag: "tag",
			},
		]);
		try {
			const data = await this.handler.getStorageData("100", "mygame", [
				{ region: 1, regionKey: "foo.bar", userId: "111", gameId: "$gameId" },
			]);
			expect(data[0].values).toEqual([{ data: "data", tag: "tag" }]);
			done();
		} catch (error) {
			done.fail(error);
		}
	});

	it("#putStorageData", async (done) => {
		new MockStorageServer().put(200, null);
		try {
			await this.handler.putStorageData(
				"100",
				"mygame",
				{ region: 1, regionKey: "foo.bar", userId: "222", gameId: "$gameId" },
				{ data: "foo" },
				{},
			);
			done();
		} catch (error) {
			done.fail(error);
		}
	});

	it("#getRawTickList", async (done) => {
		const puts: any[] = [];
		for (let i = 0; i < 10; i++) {
			if (i === 5) {
				puts.push(this.playlogStore.put("200", [i, [[0x20, 2, "tom", "test"]]]));
			} else {
				puts.push(this.playlogStore.put("200", [i]));
			}
		}
		try {
			await Promise.all(puts);
			const tickList = await this.handler.getRawTickList("200", 3, 8);
			expect(tickList[0]).toEqual(Buffer.from([3]));
			expect(tickList[1]).toEqual(Buffer.from([4]));
			expect(tickList[2]).toEqual(
				Buffer.from([
					// [5, [[0x20, 2, "tom", "test"]]]のMessagePackエンコード結果バイト列
					0x92, // Array(2)
					0x05, // fixint 5(0x05)
					0x91, // Array(1)
					0x94, // Array(4)
					0x20, // fixint 32(0x20)
					0x02, // fixint 2(0x02)
					0xa3, // fixstr (length 3)
					0x74, // char t
					0x6f, // char o
					0x6d, // char m
					0xa4, // fixstr (length 4)
					0x74, // char t
					0x65, // char e
					0x73, // char s
					0x74, // char t
				]),
			);
			done();
		} catch (error) {
			done.fail(error);
		}
	});

	it("#putStartPoint/#getStartPoint", async (done) => {
		try {
			await Promise.all([
				this.handler.putStartPoint("200", { frame: 0, data: "foo" }),
				this.handler.putStartPoint("200", { frame: 10, data: "bar" }),
				this.handler.putStartPoint("200", { frame: 20, data: "baz" }),
			]);

			const startPoint1 = await this.handler.getStartPoint("200");
			expect(startPoint1).toEqual({ frame: 0, data: "foo" });
			const startPoint2 = await this.handler.getStartPoint("200", 15);
			expect(startPoint2).toEqual({ frame: 10, data: "bar" });
			done();
		} catch (error) {
			done.fail(error);
		}
	});

	it("#getStartPoint - use cache if frame is 0", async (done) => {
		let firstStartPoint;

		try {
			await Promise.all([
				this.handler.putStartPoint("200", { frame: 0, data: "foo" }),
				this.handler.putStartPoint("200", { frame: 10, data: "bar" }),
			]);
			const startPoint1 = await this.handler.getStartPoint("200");
			expect(startPoint1).toEqual({ frame: 0, data: "foo" });
			firstStartPoint = startPoint1;
			const startPoint2 = await this.handler.getStartPoint("200", 10);
			expect(startPoint2).toEqual({ frame: 10, data: "bar" });
			await this.startPointStore.deleteTable(); // force cleanup
			await this.startPointStore.createTable();
			const cachedStartPoint = await this.handler.getStartPoint("200");
			expect(cachedStartPoint).toBe(firstStartPoint);
			const startPoint3 = await this.handler.getStartPoint("200", 10);
			expect(startPoint3).toBe(null);
			done();
		} catch (error) {
			done.fail(error);
		}
	});

	it("#getStartPoint - retry and fail", async (done) => {
		try {
			await this.handler.getStartPoint("200");
			done.fail();
		} catch (error) {
			done();
		}
	});

	it("#ref/#unref - purge cache", () => {
		expect(this.handler._refCounts).toEqual({}); // [private]
		this.handler.ref("100");
		this.handler.ref("100");
		expect(this.handler._refCounts).toEqual({ "100": 2 });

		const startPointCacheManager = this.handler._startPointCacheManager; // [private]
		const tickCacheManager = this.handler.getTickCacheManager();

		const startPointCache = startPointCacheManager.getCache("100");
		const tickCache = tickCacheManager.getCache("100");

		expect(startPointCache.destroyed).toBe(false);
		expect(tickCache.destroyed).toBe(false);

		this.handler.unref("100");
		expect(this.handler._refCounts).toEqual({ "100": 1 });

		expect(startPointCache.destroyed).toBe(false);
		expect(tickCache.destroyed).toBe(false);

		this.handler.unref("100");
		expect(this.handler._refCounts).toEqual({});

		expect(startPointCache.destroyed).toBe(true);
		expect(tickCache.destroyed).toBe(true);

		this.handler.unref("100");
		expect(this.handler._refCounts).toEqual({});
	});
});
