import * as amflowMessage from "@akashic/amflow-message";
import * as c from "../";
const TickCacheManager = c.TickCacheManager;

describe("TickCacheManager", () => {
	it("#get should cache the result", async () => {
		const handlerCalled: any[] = [];
		const bufs = [...Array(10).keys()].map((num) => Buffer.from([num]));
		const handler: any = (playId, begin, end) => {
			handlerCalled.push([playId, begin, end]);
			return Promise.resolve(bufs.slice(begin, end));
		};
		const manager = new TickCacheManager(handler);
		const cache = manager.getCache("play1");
		let ticks = await cache.get(0, 4);
		expect(ticks).toEqual(bufs.slice(0, 4));
		expect(handlerCalled).toEqual([["play1", 0, 4]]);
		ticks = await cache.get(2, 4);
		expect(ticks).toEqual(bufs.slice(2, 4));
		expect(handlerCalled).toEqual([["play1", 0, 4]]);
		ticks = await cache.get(3, 6);
		expect(ticks).toEqual(bufs.slice(3, 6));
		expect(handlerCalled).toEqual([
			["play1", 0, 4],
			["play1", 4, 6],
		]);
		ticks = await cache.get(1, 6);
		expect(ticks).toEqual(bufs.slice(1, 6));
		expect(handlerCalled).toEqual([
			["play1", 0, 4],
			["play1", 4, 6],
		]);
		ticks = await cache.get(0, 10);
		expect(ticks).toEqual(bufs.slice(0, 10));
		expect(handlerCalled).toEqual([
			["play1", 0, 4],
			["play1", 4, 6],
			["play1", 6, 10],
		]);
		ticks = await cache.get(20, 30);
		expect(ticks).toEqual([]);
		expect(handlerCalled).toEqual([
			["play1", 0, 4],
			["play1", 4, 6],
			["play1", 6, 10],
			["play1", 20, 30],
		]);
	});

	it("#get should not lack the middle of ticks", async () => {
		const handlerCalled: any = [];
		// stores 0-9 ticks in playlog-store
		const bufs = [...Array(10).keys()].map((num) => Buffer.from([num]));
		const handler: any = (playId, begin, end) => {
			handlerCalled.push([playId, begin, end]);
			return Promise.resolve(bufs.slice(begin, end));
		};
		const manager = new TickCacheManager(handler);
		const cache = manager.getCache("play1");

		// add realtime ticks 20-29 to the cache directly
		const encodedTicks: Buffer[] = [];
		for (let i = 20; i < 30; i++) {
			const tick = amflowMessage.encodeTick([i]);
			encodedTicks.push(tick);
			(cache as any).ticks[i] = tick; // [private]
		}

		let ticks = await cache.get(0, 30);
		expect(ticks).toEqual(bufs.slice(0, 10)); // expect not [0-9, empty x 10, 20-29]
		expect(handlerCalled).toEqual([["play1", 0, 30]]);
		ticks = await cache.get(9, 20);
		expect(ticks).toEqual(bufs.slice(9, 10)); // expect not [9, empty x 10, 20]
		expect(handlerCalled).toEqual([
			["play1", 0, 30],
			["play1", 10, 20],
		]);
		ticks = await cache.get(19, 29);
		expect(ticks).toEqual([]); // expect not [empty x 1, 20-29]
		expect(handlerCalled).toEqual([
			["play1", 0, 30],
			["play1", 10, 20],
			["play1", 19, 29],
		]);
	});

	it("#get should reuse the request if there is an existing request that cover given range", (done) => {
		const handlerCalled: any = [];
		const bufs = [...Array(10).keys()].map((num) => Buffer.from([num]));
		const handler: any = (playId, begin, end) => {
			handlerCalled.push([playId, begin, end]);
			return new Promise((resolve) =>
				setTimeout(() => {
					resolve(bufs.slice(begin, end));
				}, 2000),
			);
		};
		const manager = new TickCacheManager(handler);
		const cache = manager.getCache("play1");
		const resultTicks: Buffer[][] = [];
		cache.get(0, 10).then((ticks) => {
			resultTicks[0] = ticks;
			setTimeout(() => {
				expect(handlerCalled).toEqual([
					["play1", 0, 10],
					["play1", 10, 11],
					["play1", 11, 12],
				]);
				expect(resultTicks).toEqual([bufs.slice(0, 10), bufs.slice(0, 10), bufs.slice(1, 9), bufs.slice(9, 10), [], []]);
				done();
			}, 500);
		});
		cache.get(0, 10).then((ticks) => {
			// use existing request
			resultTicks[1] = ticks;
		});
		cache.get(1, 9).then((ticks) => {
			// use existing request
			resultTicks[2] = ticks;
		});
		cache.get(9, 10).then((ticks) => {
			// use existing request
			resultTicks[3] = ticks;
		});
		cache.get(10, 11).then((ticks) => {
			// create new request
			resultTicks[4] = ticks;
		});
		cache.get(11, 12).then((ticks) => {
			// create new request
			resultTicks[5] = ticks;
		});
	});

	it("#get should reject if cache is destroyed", async () => {
		const handler: any = (playId, begin, end): any => {
			fail();
		};
		const manager = new TickCacheManager(handler);
		const cache = manager.getCache("play1");
		cache.destroy();
		await expect(cache.get(10, 11)).rejects.toThrow("cache was destroyed");
	});

	it("#get should reject requests when cache is destroyed in requesting", (done) => {
		let handlerResolved = false;
		const handler: any = (playId, frame) => {
			return new Promise((resolve) =>
				setTimeout(() => {
					handlerResolved = true;
					resolve({});
				}, 1000),
			);
		};
		const manager = new TickCacheManager(handler);
		const cache = manager.getCache("play1");
		let cacheError;
		cache
			.get(0, 200)
			.then(done.fail as any)
			.catch((err) => (cacheError = err));
		setTimeout(() => {
			cache.destroy();
		}, 500);
		setTimeout(() => {
			expect(handlerResolved).toBe(true);
			expect((cacheError as Error).message).toBe("cache was destroyed");
			done();
		}, 2000);
	});

	it("#add should cache given tick", (done) => {
		const handlerCalled: any = [];
		const bufs = [...Array(10).keys()].map((num) => Buffer.from([num]));
		const handler: any = (playId, begin, end) => {
			done.fail();
		};
		const manager = new TickCacheManager(handler);
		const cache = manager.getCache("play1");
		const resultTicks: Buffer[][] = [];

		const encodedTicks: Buffer[] = [];
		for (let i = 0; i < 10; i++) {
			const tick = amflowMessage.encodeTick([i, [[0x20, 2, "tom", i]]]);
			encodedTicks.push(tick);
			cache.add(tick);
		}
		cache
			.get(0, 10)
			.then((ticks) => {
				expect(ticks).toEqual(encodedTicks);
				return cache.get(1, 2);
			})
			.then((ticks) => {
				expect(ticks).toEqual(encodedTicks.slice(1, 2));
				return cache.get(5, 9);
			})
			.then((ticks) => {
				expect(ticks).toEqual(encodedTicks.slice(5, 9));
				done();
			});
	});

	it("#add should consume shortage ticks (0 - N)", (done) => {
		const handlerCalled: any = [];
		const bufs = [...Array(10).keys()].map((num) => Buffer.from([num]));
		const handler: any = (playId, begin, end) => {
			handlerCalled.push([playId, begin, end]);
			return Promise.resolve(bufs.slice(begin, end));
		};
		const manager = new TickCacheManager(handler);
		const cache = manager.getCache("play1");
		const tick = amflowMessage.encodeTick([5]);
		cache.add(tick);
		setTimeout(() => {
			expect(handlerCalled).toEqual([["play1", 0, 5]]);
			expect((cache as any).ticks).toEqual([...bufs.slice(0, 5), tick]);
			done();
		}, 200);
	});

	it("#add should consume shortage ticks (lack the middle of ticks)", (done) => {
		const handlerCalled: any = [];
		const bufs = [...Array(20).keys()].map((num) => Buffer.from([100 + num]));
		const handler: any = (playId, begin, end) => {
			handlerCalled.push([playId, begin, end]);
			return Promise.resolve(bufs.slice(begin, end));
		};
		const manager = new TickCacheManager(handler);
		const cache = manager.getCache("play1");

		const ticks1: Buffer[] = [];
		const ticks2: Buffer[] = [];
		const ticks3: Buffer[] = [];

		// 0 - 4
		for (let i = 0; i < 5; i++) {
			const tick = amflowMessage.encodeTick([i]);
			ticks1.push(tick);
			cache.add(tick);
		}
		// lack: 5 - 9
		// 10 - 14
		for (let i = 10; i < 15; i++) {
			const tick = amflowMessage.encodeTick([i]);
			ticks2.push(tick);
			cache.add(tick);
		}
		// lack: 15
		// 16 - 20
		for (let i = 16; i < 21; i++) {
			const tick = amflowMessage.encodeTick([i]);
			ticks3.push(tick);
			cache.add(tick);
		}

		setTimeout(() => {
			expect(handlerCalled).toEqual([
				["play1", 5, 10],
				["play1", 15, 16],
			]);
			expect((cache as any).ticks).toEqual([
				// [private]
				...ticks1,
				...bufs.slice(5, 10),
				...ticks2,
				...bufs.slice(15, 16),
				...ticks3,
			]);
			done();
		}, 200);
	});
});

describe("TickCacheManager", () => {
	it("#getCache should create/reuse cache instance for play", () => {
		const handler: any = () => Promise.resolve<any>({});
		const manager = new TickCacheManager(handler);
		const cache1_1 = manager.getCache("play1");
		const cache1_2 = manager.getCache("play1");
		expect(cache1_1.playId).toBe("play1");
		expect(cache1_1).toBe(cache1_2);
		const cache2 = manager.getCache("play2");
		expect(cache2.playId).toBe("play2");
	});

	it("#purge should delete cache instance for play", () => {
		const handler: any = () => Promise.resolve<any>({});
		const manager = new TickCacheManager(handler);
		const cache1_1 = manager.getCache("play1");

		manager.purge("play1");
		expect(cache1_1.destroyed).toBe(true);

		const cache1_2 = manager.getCache("play1");
		expect(cache1_1).not.toBe(cache1_2);
	});
});
