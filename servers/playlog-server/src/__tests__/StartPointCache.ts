import * as c from "../";
const StartPointCacheManager = c.StartPointCacheManager;

describe("StartPointCache", () => {
	it("#get should cache the result", async () => {
		const handlerCalled: (number | string)[][] = [];
		const handler = (playId, frame) => {
			handlerCalled.push([playId, frame]);
			return Promise.resolve<any>("called_" + handlerCalled.length);
		};
		const manager = new StartPointCacheManager(handler);
		const cache = manager.getCache("play1");

		let sp = await cache.get(200);
		expect<any>(sp).toBe("called_1");
		expect(handlerCalled).toEqual([["play1", 200]]);
		sp = await cache.get(200);
		expect<any>(sp).toBe("called_1");
		expect(handlerCalled).toEqual([["play1", 200]]);
		sp = await cache.get(201);
		expect<any>(sp).toBe("called_2");
		expect(handlerCalled).toEqual([
			["play1", 200],
			["play1", 201],
		]);
		sp = await cache.get(202);
		expect<any>(sp).toBe("called_3");
		expect(handlerCalled).toEqual([
			["play1", 200],
			["play1", 201],
			["play1", 202],
		]);
		sp = await cache.get(202);
		expect<any>(sp).toBe("called_3");
		expect(handlerCalled).toEqual([
			["play1", 200],
			["play1", 201],
			["play1", 202],
		]);
	});

	it("#get should not cache if the result is null", async () => {
		const handlerCalled: (number | string)[][] = [];
		const handler = (playId, frame) => {
			handlerCalled.push([playId, frame]);
			return Promise.resolve<any>(null);
		};
		const manager = new StartPointCacheManager(handler);
		const cache = manager.getCache("play1");
		let sp = await cache.get(200);
		expect<any>(sp).toBe(null);
		expect(handlerCalled).toEqual([["play1", 200]]);
		sp = await cache.get(200);
		expect<any>(sp).toBe(null);
		expect(handlerCalled).toEqual([
			["play1", 200],
			["play1", 200],
		]);
		sp = await cache.get(200);
		expect<any>(sp).toBe(null);
		expect(handlerCalled).toEqual([
			["play1", 200],
			["play1", 200],
			["play1", 200],
		]);
	});

	it("#get should not request again if the request of given frame exists", (done) => {
		const handlerCalled: (number | string)[][] = [];
		let handlerCalledCnt = 0;
		const handler = (playId, frame) => {
			handlerCalled.push([playId, frame]);
			handlerCalledCnt++;
			if (frame === 202) {
				return new Promise<any>((resolve) =>
					setTimeout(() => {
						resolve({ msg: "100ms-return" });
					}, 100),
				);
			}
			return new Promise<any>((resolve) =>
				setTimeout(() => {
					resolve({});
				}, 2000),
			);
		};

		const manager = new StartPointCacheManager(handler);
		const cache = manager.getCache("play1");

		let req2Result;
		let req3Result;
		cache.get(200).then((sp) => {
			setTimeout(() => {
				expect(sp).toBe(req2Result);
				expect(handlerCalledCnt).toBe(2);
				expect(req3Result.msg).toBe("100ms-return");
				expect<any>(handlerCalled).toEqual([
					["play1", 200],
					["play1", 202],
				]);
				expect(Object.keys((cache as any).waitingRequests)).toEqual([]); // [private]
				done();
			}, 500);
		});
		cache.get(200).then((sp) => (req2Result = sp));
		setTimeout(() => {
			cache.get(202).then((sp) => {
				req3Result = sp;
				expect(Object.keys((cache as any).waitingRequests).sort()).toEqual(["200"]);
			});
			expect(Object.keys((cache as any).waitingRequests).sort()).toEqual(["200", "202"]);
			expect((cache as any).waitingRequests["200"].length).toBe(2);
			expect((cache as any).waitingRequests["202"].length).toBe(1);
		}, 200);
	});

	it("#get should throw error if the handler throws error", (done) => {
		const handlerError = {};
		const handler = (playId, frame) => {
			return new Promise<any>((_, reject) => {
				setTimeout(() => {
					return reject(handlerError);
				}, 2000);
			});
		};

		const manager = new StartPointCacheManager(handler);
		const cache = manager.getCache("play1");

		let req2Error;
		cache
			.get(200)
			.then(() => {
				done.fail();
			})
			.catch((err) => {
				setTimeout(() => {
					expect(err).toBe(handlerError);
					expect(req2Error).toBe(handlerError);
					expect(Object.keys((cache as any).waitingRequests)).toEqual([]); // [private]
					done();
				}, 500);
			});
		cache
			.get(200)
			.then(() => {
				done.fail();
			})
			.catch((err) => {
				req2Error = err;
			});
		expect(Object.keys((cache as any).waitingRequests).sort()).toEqual(["200"]);
		expect((cache as any).waitingRequests["200"].length).toBe(2);
	});

	it("#get should reject if cache is destroyed", async () => {
		const handler = (playId, frame): any => {
			fail();
		};
		const manager = new StartPointCacheManager(handler);
		const cache = manager.getCache("play1");
		cache.destroy();
		await expect(cache.get(200)).rejects.toThrow("cache was destroyed");
	});

	it("#get should reject when cache is destroyed in requesting", (done) => {
		let handlerResolved = false;
		const handler = (playId, frame) => {
			return new Promise<any>((resolve) =>
				setTimeout(() => {
					handlerResolved = true;
					resolve({});
				}, 1000),
			);
		};
		const manager = new StartPointCacheManager(handler);
		const cache = manager.getCache("play1");
		let cacheError;
		cache
			.get(200)
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
});

describe("StartPointCacheManager", () => {
	it("#getCache should create/reuse cache instance for play", () => {
		const handler = () => Promise.resolve<any>({});
		const manager = new StartPointCacheManager(handler);
		const cache1_1 = manager.getCache("play1");
		const cache1_2 = manager.getCache("play1");
		expect(cache1_1.playId).toBe("play1");
		expect(cache1_1).toBe(cache1_2);
		const cache2 = manager.getCache("play2");
		expect(cache2.playId).toBe("play2");
	});

	it("#purge should delete cache instance for play", () => {
		const handler = () => Promise.resolve<any>({});
		const manager = new StartPointCacheManager(handler);
		const cache1_1 = manager.getCache("play1");

		manager.purge("play1");
		expect(cache1_1.destroyed).toBe(true);

		const cache1_2 = manager.getCache("play1");
		expect(cache1_1).not.toBe(cache1_2);
	});
});
