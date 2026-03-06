import { default as Redis } from "ioredis";
import Config from "config";
import * as Mysql from "mysql";
import { IPlayTokenPermissionBoundary, LegacyCacheStore, PlayRelationModel } from "../";
import { IDatabaseHost } from "../../../Config";

describe("PlayRelationModel Feature", () => {
	// MySQL
	const hosts = Config.get<IDatabaseHost[]>("dbSettings.database.hosts");
	const hostName = hosts[0].host;
	const portNumber = hosts[0].port;
	const mysqlPool = Mysql.createPool({
		bigNumberStrings: true,
		supportBigNumbers: true,
		database: Config.get("dbSettings.database.database"),
		host: hostName,
		user: Config.get("dbSettings.database.user"),
		password: Config.get("dbSettings.database.password"),
		port: portNumber,
		charset: "utf8mb4",
		stringifyObjects: true,
	});

	// Redis
	const redis = new Redis({
		host: Config.get<string>("redis.host"),
		port: Config.get<number>("redis.port"),
	});

	// 前に実行された it に依存する it が含まれる describe があるので、 beforeEach にできない。
	beforeAll((done) => {
		// database migration について
		//  以下のタスクの後に、やり直しする
		//  1. db-migration リポジトリにあるやつをこっちに移行してくる
		//  2. Sequelize （=umzug） で migration と seeding をできるようにする
		//  3. 関数を呼び出せば migration & seeding できるようにする
		// とりあえず、この Spec ファイル内で使うであろう DataBase に対して、手動で Seeding する。
		// Redis について
		//  DB Flush で良い。
		mysqlPool.getConnection((connectionError, connection) => {
			if (connectionError) {
				fail(connectionError);
			}

			Promise.all([
				connection.query("DELETE FROM play_relations", (queryError) => {
					connection.release();
					if (queryError) {
						fail(queryError);
						return;
					}
					return;
				}),
				redis.flushdb(),
			])
				.then(() => done())
				.catch((error) => fail(error));
		});
	});

	describe("basic usage", () => {
		const model = PlayRelationModel.create(redis, mysqlPool);

		it("can CREATE", async () => {
			const result = await model.store("1", "2", {
				allow: {
					readTick: true,
					writeTick: true,
					subscribeTick: false,
					sendEvent: false,
					subscribeEvent: false,
					maxEventPriority: 0,
				},
			});
			expect(result).toBe(true);
		});

		it("can READ", async () => {
			{
				// play id が 2 の Play の 親プレイと、その親プレから引き継がれるときのパーミッション
				const result = await model.findByChild("2");
				// 直前の it ("can CREATE") で登録したものがとれる
				expect(result.get("1")).toEqual({
					allow: {
						readTick: true,
						writeTick: true,
						subscribeTick: false,
						sendEvent: false,
						subscribeEvent: false,
						maxEventPriority: 0,
					},
				});
			}

			{
				// play id が 2 の Play の 親プレイの play id
				const result: string[] = await model.findParentPlayIdsByChild("2");
				expect(result).toEqual(["1"]);
			}
		});

		it("can clear cache", async () => {
			const result = await model.destroy("1", "2");
			expect(result).toBe(true);
		});
	});

	describe("multiple parent plays register,", () => {
		it("find parent play ids by child play", async () => {
			const model = PlayRelationModel.create(redis, mysqlPool);

			await model.store("10", "20", {
				allow: {
					readTick: true,
					writeTick: true,
					subscribeTick: true,
					sendEvent: true,
					subscribeEvent: true,
					maxEventPriority: 99,
				},
			});

			await model.store("20", "30", {
				allow: {
					readTick: true,
					writeTick: true,
					subscribeTick: true,
					sendEvent: true,
					subscribeEvent: true,
					maxEventPriority: 99,
				},
			});

			const result: string[] = await model.findParentPlayIdsByChild("30");
			expect(result).toEqual(["10", "20"]);
		});
	});

	describe("before register,", () => {
		const model = PlayRelationModel.create(redis, mysqlPool);

		describe("find parent plays by child play", () => {
			it("should return empty Map", async () => {
				const value = await model.findByChild("9999");
				const emptyMap = new Map<string, IPlayTokenPermissionBoundary | null>();

				expect(value).toEqual(emptyMap);
			});
		});

		describe("find parent play ids by child play", () => {
			it("should return empty List", async () => {
				const parentPlayIds: string[] = await model.findParentPlayIdsByChild("9999");

				expect(parentPlayIds).toEqual([]);
			});
		});
	});

	describe("when cache will miss", () => {
		// describe の cb が async function にできなさそうだったので、 Arrange も it に閉じ込めた
		it("should found parent plays", async () => {
			// Arrange
			const model = PlayRelationModel.create(redis, mysqlPool);
			await model.store("1", "3", {
				allow: {
					readTick: true,
					writeTick: true,
					subscribeTick: true,
					sendEvent: true,
					subscribeEvent: true,
					maxEventPriority: 99,
				},
			});
			// キャッシュしか破棄しないメソッド
			await model.destroy("1", "3");

			// Act
			const actual = await model.findByChild("3");
			const expectMap = new Map();
			expectMap.set("1", {
				allow: {
					readTick: true,
					writeTick: true,
					subscribeTick: true,
					sendEvent: true,
					subscribeEvent: true,
					maxEventPriority: 99,
				},
			});

			expect(actual).toEqual(expectMap);
		});

		describe("in findByChild method", () => {
			// Cache miss するような状態で、 findByChild メソッドを実行した場合に、Cache し直す
			//   という副作用があることをテストする
			it("should re-cache", async () => {
				// Arrange
				const model = PlayRelationModel.create(redis, mysqlPool);
				await model.store("1", "4", {
					allow: {
						readTick: true,
						writeTick: true,
						subscribeTick: true,
						sendEvent: true,
						subscribeEvent: true,
						maxEventPriority: 99,
					},
				});
				// キャッシュしか破棄しないメソッド
				await model.destroy("1", "4");

				// Act
				// ここでキャッシュし直される
				await model.findByChild("4");

				// 再キャッシュする処理は放ちっぱなしの Promise で処理されるので、await してもタイミングによっては Fail する。
				//   ちょっと待機して、再キャッシュされる前に Assert が走る事故を緩和する
				return new Promise<void>((resolve) => {
					setTimeout(async () => {
						// Assert
						const actual = await new LegacyCacheStore(redis).findByChild("4");
						const expectMap = new Map();
						expectMap.set("1", {
							allow: {
								readTick: true,
								writeTick: true,
								subscribeTick: true,
								sendEvent: true,
								subscribeEvent: true,
								maxEventPriority: 99,
							},
						});

						expect(actual).toEqual(expectMap);

						resolve();
					}, 500);
				});
			});
		});
	});

	describe("when store duplicate record", () => {
		// todoテスト(jasmine時代のpending)はjestだとエラーになったのでテスト自体を無効化
		xit("should update record", () => {
			// 手抜きをしているため、更新ではなく「DUPLICATED KEY」でエラーになる。
			test.todo("not implemented");
		});
	});

	describe("cache TTL", () => {
		it("should have expiration", async () => {
			const model = PlayRelationModel.create(redis, mysqlPool);

			await model.store("1", "5", {
				allow: {
					readTick: true,
					writeTick: true,
					subscribeTick: true,
					sendEvent: true,
					subscribeEvent: true,
					maxEventPriority: 99,
				},
			});

			expect(await redis.ttl(LegacyCacheStore.getKeyName("5"))).toBeGreaterThanOrEqual(0);
		});
	});
});
