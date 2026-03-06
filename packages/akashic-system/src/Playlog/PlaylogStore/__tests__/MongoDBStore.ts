import config from "config";
import { MongoClient } from "mongodb";
import { MongoDBStore } from "../";
import { EventCode, EventFlagsMask } from "@akashic/playlog";

import type { Tick } from "@akashic/playlog";
import type { StartPoint } from "@akashic/amflow";

describe("MongoDBStoreのlargeテスト", () => {
	const tick1: Tick = [1];
	const tick2: Tick = [2];
	const tick1WithIgnorableEvent: Tick = [1, [[EventCode.Message, EventFlagsMask.Ignorable, null]]];
	const startPoint1: StartPoint = {
		frame: 1,
		timestamp: 12345678,
		data: "data",
	};
	const startPoint2: StartPoint = {
		frame: 2,
		timestamp: 12345678,
		data: "data2",
	};

	it("tickのread/writeテスト", async () => {
		// 初期化
		const playId = "3344348858";
		const client = new MongoClient(config.get("mongodb.url"));
		await client.connect();
		const db = client.db("akashic_test");

		// テスト
		const store = new MongoDBStore(db);
		await store.putTick(playId, tick1);

		const result1 = await store.getTick(playId, 1);
		expect(result1).toEqual(tick1);
		const result4 = await store.getTick(playId, 1234567);
		expect(result4).toEqual(null);

		await store.putTick(playId, tick2);

		const result2 = await store.getTicks({ playId, limit: 100 });
		expect(result2).toEqual([tick1, tick2]);
		const result3 = await store.getTicksRaw({ playId, limit: 100 });
		expect(result3.length).toBe(2);
		const result5 = await store.getTicksRaw({ playId, limit: 100, frameFrom: 1, frameTo: 2 });
		expect(result5.length).toBe(1);

		const newTick: Tick = [tick1[0], [[0, 1, null]]];
		await store.updateTick(playId, newTick);

		const tick = await store.getTick(playId, 1);
		const event = tick ? tick[1] : undefined;
		expect(event).toBeTruthy();

		// 終了処理
		await client.close();
	});

	it("startPointのread/writeテスト", async () => {
		// 初期化
		const playId = "3344348858";
		const client = new MongoClient(config.get("mongodb.url"));
		await client.connect();
		const db = client.db("akashic_test");

		// テスト
		const store = new MongoDBStore(db);
		await store.putStartPoint(playId, startPoint1);

		const result1 = await store.getStartPoint(playId, 1);
		expect(result1).toEqual(startPoint1);
		const result4 = await store.getStartPoint(playId, 112345678);
		expect(result4).toEqual(null);

		await store.putStartPoint(playId, startPoint2);

		const result2 = await store.getStartPoints({ playId, limit: 100 });
		expect(result2).toEqual([startPoint1, startPoint2]);
		const result3 = await store.getClosestStartPoint(playId, 4);
		expect(result3).toEqual(startPoint2);
		const result5 = await store.getClosestStartPoint(playId, 0);
		expect(result5).toEqual(null);

		// 終了処理
		await client.close();
	});

	it("指定した timestamp 未満の最も大きい startpoint を取得できる", async () => {
		const playId = "3344348861";
		const client = new MongoClient(config.get("mongodb.url"));
		await client.connect();
		const db = client.db("akashic_test_");

		const store = new MongoDBStore(db);
		await store.putStartPoint(playId, { frame: 0, timestamp: 1711964900726, data: "zero" });
		await store.putStartPoint(playId, { frame: 100, timestamp: 1711975649699.7573, data: "100" });
		await store.putStartPoint(playId, { frame: 200, timestamp: 1711976055798.7659, data: "200" });
		await store.putStartPoint(playId, { frame: 300, timestamp: 1711977012350.1234, data: "300" });
		await store.putStartPoint(playId, { frame: 400, timestamp: 1711978092112.8414, data: "400" });
		{
			const timestamp = 1711975884944;
			const result = await store.getClosestStartPointByTimestamp(playId, timestamp);
			expect(result?.data).toEqual("100");
		}
		{
			const timestamp = 1711978092112.9999;
			const result = await store.getClosestStartPointByTimestamp(playId, timestamp);
			expect(result?.data).toEqual("400");
		}
		{
			const timestamp = 1711964900725;
			const result = await store.getClosestStartPointByTimestamp(playId, timestamp);
			expect(result).toEqual(null);
		}
		{
			const timestamp = 1711964900726.1;
			const result = await store.getClosestStartPointByTimestamp(playId, timestamp);
			expect(result?.data).toEqual("zero");
		}
	});

	it("store/archive周りのテスト", async () => {
		// 初期化
		const playId = "3344348858";
		const client = new MongoClient(config.get("mongodb.url"));
		await client.connect();
		const db = client.db("akashic_test");

		// テスト
		const store = new MongoDBStore(db);
		await store.store(playId, { original: [tick1WithIgnorableEvent, tick2], excludedIgnorable: [tick1, tick2] }, [
			startPoint1,
			startPoint2,
		]);

		// store したら取れる
		const result1 = await store.getAllTicks(playId);
		expect(result1).toEqual({ original: [tick1WithIgnorableEvent, tick2], excludedIgnorable: [tick1, tick2] });
		const result2 = await store.getAllStartPoints(playId);
		expect(result2).toEqual([startPoint1, startPoint2]);

		// delete したので、取れなくなる
		await store.deleteAll(playId);
		const result3 = await store.getAllTicks(playId);
		expect(result3).toEqual({ original: [], excludedIgnorable: [] });
		const result4 = await store.getAllStartPoints(playId);
		expect(result4).toEqual([]);

		// 終了処理
		await client.close();
	});

	it("collectionへの操作時にエラーが起きた場合のテスト", async () => {
		// 初期化
		const playId = "3344348858";
		const client = new MongoClient(config.get("mongodb.url"));
		await client.connect();
		const db = client.db("akashic_test");
		// collectionを差し替えてfind当の操作をしたときにエラーを出すように細工する
		const collectionOriginal = db.collection.bind(db);
		db.collection = jest.fn().mockImplementation((collectionName: string) => {
			const collection = collectionOriginal(collectionName);
			return new Proxy(collection, {
				get: (target, prop, receiver) => {
					const result = Reflect.get(target, prop, receiver);
					if (typeof result === "function") {
						switch (prop) {
							case "find":
								return jest.fn().mockImplementation(() => {
									throw new Error("test");
								});
						}
						return jest.fn().mockImplementation(async () => {
							throw new Error("test");
						});
					}
					return result;
				},
			});
		});
		// エラー処理のテスト
		const store = new MongoDBStore(db);
		const newTick: Tick = [tick1[0], [[0, 1, null]]];

		await expect(store.putTick(playId, tick1)).rejects.toThrow("test");
		await expect(store.getTick(playId, 1)).rejects.toThrow("test");
		await expect(store.getTicks({ playId, limit: 100 })).rejects.toThrow("test");
		await expect(store.getTicksRaw({ playId, limit: 100 })).rejects.toThrow("test");
		await expect(store.updateTick(playId, newTick)).rejects.toThrow("test");
		await expect(store.getTick(playId, 1)).rejects.toThrow("test");
		await expect(store.putStartPoint(playId, startPoint1)).rejects.toThrow("test");
		await expect(store.getStartPoint(playId, 1)).rejects.toThrow("test");
		await expect(store.getStartPoints({ playId, limit: 100 })).rejects.toThrow("test");
		await expect(store.getClosestStartPoint(playId, 4)).rejects.toThrow("test");
		await expect(
			store.store(playId, { original: [tick1WithIgnorableEvent, tick2], excludedIgnorable: [tick1, tick2] }, [startPoint1, startPoint2]),
		).rejects.toThrow("test");
		await expect(store.getAllTicks(playId)).rejects.toThrow("test");
		await expect(store.getAllStartPoints(playId)).rejects.toThrow("test");
		await expect(store.deleteAll(playId)).rejects.toThrow("test");

		// 終了処理
		await client.close();
	});

	it("ignorableイベントを含んだtickのread/writeテスト", async () => {
		const playId = "3344348859";
		const client = new MongoClient(config.get("mongodb.url"));
		await client.connect();
		const db = client.db("akashic_test");
		const store = new MongoDBStore(db);

		await store.putTick(playId, tick1, { ignorable: true });
		await store.putTick(playId, tick1WithIgnorableEvent);

		const result1 = await store.getTick(playId, 1, { ignorable: true });
		expect(result1).toEqual(tick1);
		const result2 = await store.getTick(playId, 1);
		expect(result2).toEqual(tick1WithIgnorableEvent);

		const result3 = await store.getTicks({ playId, limit: 10, excludeEventFlags: { ignorable: true } });
		expect(result3).toEqual([tick1]);
		const result4 = await store.getTicks({ playId, limit: 10 });
		expect(result4).toEqual([tick1WithIgnorableEvent]);
	});

	it("ignorableが除外されたtickが保存されてない場合にignorable指定でgetした場合、通常版のtickが取れる", async () => {
		const playId = "3344348860";
		const client = new MongoClient(config.get("mongodb.url"));
		await client.connect();
		const db = client.db("akashic_test");
		const store = new MongoDBStore(db);
		await store.putTick(playId, tick1WithIgnorableEvent);

		const result1 = await store.getTick(playId, 1, { ignorable: true });
		expect(result1).toEqual(tick1WithIgnorableEvent);
		const result2 = await store.getTicks({ playId, limit: 10, excludeEventFlags: { ignorable: true } });
		expect(result2).toEqual([tick1WithIgnorableEvent]);
	});
});
