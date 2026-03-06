import * as amflowMessage from "@akashic/amflow-message";
import * as lu from "@akashic/log-util";
import * as playlogAMQP from "@akashic/playlog-amqp";
import * as playlogStore from "@akashic/playlog-store";
import config from "config";
import * as log4js from "log4js";
import * as mongodb from "mongodb";
import { AMQPConnectionFactory } from "./AMQPConnectionFactory";
import * as MockZooKeeper from "./MockZooKeeper";
import { PlaylogHandler } from "./PlaylogHandler";
import * as writeLock from "./PlaylogWriteLock";
import { TickCacheManager } from "./TickCache";
const logger = new lu.LogUtil(log4js.getLogger("out"));

describe("PlaylogHandler", () => {
	jasmine.DEFAULT_TIMEOUT_INTERVAL = 10 * 1000;
	let tickAMQPClient;
	let eventAMQPClient;
	beforeAll(async (done) => {
		const mongoUrl: string = config.get("datastore.mongodb.url");
		const dbName = config.get("datastore.mongodb.database");

		this.amqpConnectionFactory = new AMQPConnectionFactory(config.get("rabbitmq"), logger);
		const conn = await this.amqpConnectionFactory.newConnection();
		this.amqpConnection = conn;
		const ch = await conn.createChannel();
		this.amqpChannel = ch;
		await new Promise((resolve, reject) => {
			mongodb.MongoClient.connect(mongoUrl, (error, client) => {
				if (error) {
					done.fail(error);
					return reject(error);
				}
				this.client = client;
				return resolve();
			});
		});
		tickAMQPClient = this.tickAMQPClient = new playlogAMQP.Tick(this.amqpChannel);
		eventAMQPClient = this.eventAMQPClient = new playlogAMQP.Event(this.amqpChannel);
		this.playlogStore = new playlogStore.PlaylogMongoDBStore(this.client.db(dbName));
		try {
			await this.playlogStore.deleteTable();
			await this.playlogStore.createTable();
		} catch (error) {
			done.fail(error);
		}
		done();
	});

	afterAll(async (done) => {
		await this.client.close(true, async (err) => {
			if (err) {
				return done.fail(err);
			}
			try {
				await this.amqpChannel.close();
				await this.amqpConnection.close();
			} catch (error) {
				done.fail(error);
			}
			done();
		});
	});

	beforeEach(() => {
		this.tickCacheManager = new TickCacheManager(() => Promise.resolve([]));
		this.handler = new PlaylogHandler(
			this.amqpConnectionFactory,
			this.playlogStore,
			this.tickCacheManager,
			new writeLock.Client(new MockZooKeeper.Promise() as any),
			1000,
			10,
			logger,
		);
	});

	afterEach(async (done) => {
		try {
			await this.handler.cleanup();
			await this.playlogStore.deleteTable();
			done();
		} catch (e) {
			done();
		}
	});

	async function assertExchangeAndQueue(playId: string): Promise<void> {
		await tickAMQPClient.assertExchange(playId);
		await eventAMQPClient.assertExchange(playId);
		eventAMQPClient.assertQueue(playId);
	}

	async function deleteExchangeAndQueue(playId: string): Promise<void> {
		await tickAMQPClient.deleteExchange(playId);
		await eventAMQPClient.deleteQueue(playId);
		eventAMQPClient.deleteExchange(playId);
	}

	it("should publish/consume events", async (done) => {
		const handler = this.handler;
		let pubCount = 0;
		let subCount = 0;
		const c = {};
		const consumer = async (ev) => {
			const d = amflowMessage.decodeEvent(ev);
			expect(d[3]).toBe(subCount);
			if (subCount === 9) {
				await handler.offConsumeEvent("100", consumer);
				await handler.close("100", c);
				await deleteExchangeAndQueue("100");
				done();
			}
			subCount++;
		};
		try {
			await assertExchangeAndQueue("100");
			await handler.prepare("100", c);

			await handler.consumeEvent("100", consumer);
			const timer = setInterval(() => {
				if (pubCount < 10) {
					handler.publishEvent("100", [0x20, 2, "tom", pubCount++]);
				} else {
					clearInterval(timer);
				}
			}, 33);
		} catch (error) {
			done.fail(error);
		}
	});

	it("should off consume event handler", async (done) => {
		const handler = this.handler;
		let pubCount = 0;
		let subCount1 = 0;
		let subCount2 = 0;
		const c = {};
		const consumer1 = async (ev) => {
			const d = amflowMessage.decodeEvent(ev);
			expect(d[3]).toBe(subCount1);
			if (subCount1 === 5) {
				handler.offConsumeEvent("100", consumer1);
				return;
			}
			subCount1++;
		};
		const consumer2 = async (ev) => {
			const d = amflowMessage.decodeEvent(ev);
			expect(d[3]).toBe(subCount2);
			if (subCount2 === 9) {
				expect(subCount1).toBe(5);
				await handler.offConsumeEvent("100", consumer2);
				await handler.close("100", c);
				await deleteExchangeAndQueue("100");
				done();
			}
			subCount2++;
		};
		try {
			await assertExchangeAndQueue("100");
			await handler.prepare("100", c);
			await handler.consumeEvent("100", consumer1);
			await handler.consumeEvent("100", consumer2);
			const timer = setInterval(() => {
				handler.publishEvent("100", [0x20, 3, "sam", pubCount++]);
				if (pubCount === 10) {
					clearInterval(timer);
				}
			}, 33);
		} catch (error) {
			done.fail(error);
		}
	});

	it("should publish/consume multiple play events", async (done) => {
		const handler = this.handler;
		let pubCount = 0;
		let subCount100 = 0;
		let subCount200 = 0;
		const client = this.eventAMQPClient;
		const c1 = {};
		const c2 = {};
		const consumer100 = (ev) => {
			const d = amflowMessage.decodeEvent(ev);
			expect(d[2]).toBe("tom100");
			expect(d[3]).toBe(subCount100);
			subCount100++;
		};
		const consumer200 = (ev) => {
			const d = amflowMessage.decodeEvent(ev);
			expect(d[2]).toBe("tom200");
			expect(d[3]).toBe(subCount200);
			subCount200++;
		};
		await assertExchangeAndQueue("100");
		await assertExchangeAndQueue("200");
		await handler.prepare("100", c1);
		await handler.prepare("200", c2);
		await handler.consumeEvent("100", consumer100);
		await handler.consumeEvent("200", consumer200);
		try {
			const timer = setInterval(async () => {
				if (pubCount < 10) {
					handler.publishEvent("100", [0x20, 2, "tom100", pubCount]);
					handler.publishEvent("200", [0x20, 2, "tom200", pubCount]);
					pubCount++;
				} else {
					clearInterval(timer);
					setTimeout(async () => {
						if (subCount100 === 10 && subCount200 === 10) {
							await handler.offConsumeEvent("100", consumer100);
							await handler.offConsumeEvent("200", consumer200);
							await handler.close("100", c1);
							await handler.close("200", c2);
							await Promise.all([deleteExchangeAndQueue("100"), deleteExchangeAndQueue("200")]);
							done();
						}
					}, 300);
				}
			}, 33);
		} catch (error) {
			done.fail(error);
		}
	});

	it("should publish/consume events(prefetch)", async (done) => {
		// 1秒に2イベントしかconsumeしないことを確認する
		const handler = new PlaylogHandler(
			this.amqpConnectionFactory,
			this.playlogStore,
			this.tickCacheManager,
			new writeLock.Client(new MockZooKeeper.Promise() as any),
			2,
			1000,
			logger,
		);
		let pubCount = 0;
		let subCount = 0;
		const client = this.eventAMQPClient;
		const c = {};
		const start = Date.now();
		const consumer = async (ev) => {
			const d = amflowMessage.decodeEvent(ev);
			expect(d[3]).toBe(subCount);
			if (subCount === 9) {
				const delta = Date.now() - start;
				expect(3750 < delta && delta < 4250).toBeTruthy();
				await handler.offConsumeEvent("100", consumer);
				await handler.close("100", c);
				await deleteExchangeAndQueue("100");
				done();
			}
			subCount++;
		};
		try {
			await assertExchangeAndQueue("100");
			await handler.prepare("100", c);
			await handler.consumeEvent("100", consumer);
			const timer = setInterval(() => {
				if (pubCount < 10) {
					// 優先度3にして破棄されないようにする
					handler.publishEvent("100", [0x20, 3, "tom", pubCount++]);
				} else {
					clearInterval(timer);
				}
			}, 10);
		} catch (error) {
			done.fail(error);
		}
	});

	it("should publish/consume ticks", async (done) => {
		const handler = this.handler;
		let pubCount = 0;
		let subCount = 0;
		const client = this.tickAMQPClient;
		const c = {};
		const consumer = async (tick) => {
			const t = amflowMessage.decodeTick(tick);
			expect(t[0]).toBe(subCount);
			if (subCount % 2) {
				expect(t.length).toBe(2);
				expect((t as any)[1][0][3]).toBe(subCount);
			} else {
				expect(t.length).toBe(1);
			}
			if (subCount === 9) {
				await handler.offConsumeTick("100", consumer);
				await handler.close("100", c);
				await client.deleteExchange("100");
				done();
			}
			subCount++;
		};
		try {
			await assertExchangeAndQueue("100");
			await handler.prepare("100", c);
			await handler.acquireWriteLock("100", done.fail);
			await handler.consumeTick("100", consumer);
			const timer = setInterval(() => {
				if (pubCount < 10) {
					const tick: any = [pubCount];
					if (pubCount % 2) {
						tick[1] = [[0x20, 2, "tom100", pubCount]];
					}
					handler.publishTickRaw("100", amflowMessage.encodeTick(tick));
					pubCount++;
				} else {
					clearInterval(timer);
				}
			}, 33);
		} catch (error) {
			done.fail(error);
		}
	});

	it("should off consume tick handler", async (done) => {
		const handler = this.handler;
		let pubCount = 0;
		let subCount1 = 0;
		let subCount2 = 0;
		const c = {};
		const consumer1 = (tick) => {
			const t = amflowMessage.decodeTick(tick);
			expect(t[0]).toBe(subCount1);
			if (subCount1 === 5) {
				handler.offConsumeTick("100", consumer1);
				return;
			}
			subCount1++;
		};
		const consumer2 = async (tick) => {
			const t = amflowMessage.decodeTick(tick);
			expect(t[0]).toBe(subCount2);
			if (subCount2 === 9) {
				expect(subCount1).toBe(5);
				await handler.offConsumeTick("100", consumer2);
				await handler.close("100", c);
				await deleteExchangeAndQueue("100");
				done();
			}
			subCount2++;
		};
		try {
			assertExchangeAndQueue("100");
			await handler.prepare("100", c);
			await handler.acquireWriteLock("100", done.fail);
			await handler.consumeTick("100", consumer1);
			await handler.consumeTick("100", consumer2);
			const timer = setInterval(() => {
				handler.publishTickRaw("100", amflowMessage.encodeTick([pubCount++]));
				if (pubCount === 10) {
					clearInterval(timer);
				}
			}, 33);
		} catch (error) {
			done.fail(error);
		}
	});

	it("should publish/consume multiple play ticks", async (done) => {
		const handler = this.handler;
		let pubCount = 0;
		let subCount100 = 0;
		let subCount200 = 0;
		const c1 = {};
		const c2 = {};
		const consumer100 = (tick) => {
			const t = amflowMessage.decodeTick(tick);
			expect(t[0]).toBe(subCount100);
			subCount100++;
		};
		const consumer200 = (tick) => {
			const t = amflowMessage.decodeTick(tick);
			expect(t[0]).toBe(subCount200 + 100);
			subCount200++;
		};

		try {
			await assertExchangeAndQueue("100");
			await handler.prepare("100", c1);
			await assertExchangeAndQueue("200");
			await handler.prepare("200", c2);
			await handler.acquireWriteLock("100", done.fail);
			await handler.acquireWriteLock("200", () => {
				done.fail(new Error("lock was released"));
			});
			await handler.consumeTick("100", consumer100);
			await handler.consumeTick("200", consumer200);
			const timer = setInterval(() => {
				if (pubCount < 10) {
					handler.publishTickRaw("100", amflowMessage.encodeTick([pubCount]));
					handler.publishTickRaw("200", amflowMessage.encodeTick([pubCount + 100]));
					pubCount++;
				} else {
					clearInterval(timer);
					setTimeout(() => {
						if (subCount100 === 10 && subCount200 === 10) {
							handler.offConsumeTick("100", consumer100).then(async () => {
								await handler.offConsumeTick("200", consumer200);
								await handler.close("100", c1);
								await handler.close("200", c2);
								await Promise.all([deleteExchangeAndQueue("100"), deleteExchangeAndQueue("200")]);
								done();
							}, 300);
						}
					}, 33);
				}
			});
		} catch (error) {
			done.fail(error);
		}
	});

	it("should add received ticks to cache", async (done) => {
		const tickCacheManager = this.tickCacheManager;
		const handler = this.handler;
		let pubCount = 0;
		let subCount = 0;
		const client = this.tickAMQPClient;
		const c = {};
		const receivedTicks: any[] = [];
		const consumer = async (tick) => {
			receivedTicks.push(tick);
			if (subCount === 9) {
				const cachedTicks = await tickCacheManager.getCache("100").get(0, 9);
				expect(cachedTicks).toEqual(receivedTicks.slice(0, 9));
				await handler.offConsumeTick("100", consumer);
				await handler.close("100", c);
				await client.deleteExchange("100");
				done();
			}
			subCount++;
		};
		try {
			await assertExchangeAndQueue("100");
			await handler.prepare("100", c);
			await handler.acquireWriteLock("100", done.fail);
			await handler.consumeTick("100", consumer);
			const timer = setInterval(() => {
				if (pubCount < 10) {
					const tick: any = [pubCount];
					if (pubCount % 2) {
						tick[1] = [[0x20, 2, "tom100", pubCount]];
					}
					handler.publishTickRaw("100", amflowMessage.encodeTick(tick));
					pubCount++;
				} else {
					clearInterval(timer);
				}
			}, 33);
		} catch (error) {
			done.fail(error);
		}
	});
});
