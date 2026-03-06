declare const global: any;

import * as lu from "@akashic/log-util";
import * as playlogAMQP from "@akashic/playlog-amqp";
import * as playlogClient from "@akashic/playlog-client";
import * as playTokenAMQP from "@akashic/playtoken-amqp";
import * as amqp from "amqplib";
import config from "config";
import * as log4js from "log4js";
import * as nock from "nock";
import * as ZooKeeper from "@akashic/zookeeper";
import { Application } from "./";
import { AMQPConnectionFactory } from "./AMQPConnectionFactory";
import Constants from "./Constants";
import MockStorageServer from "./MockStorageServer";
import MockSystemControlServer from "./MockSystemControlServer";
import * as MockZooKeeper from "./MockZooKeeper";
import WebSocket from "./WebSocketAPI";

const activeUserId = Constants.activeUserId;
const passiveUserId = Constants.passiveUserId;

const logger = new lu.LogUtil(log4js.getLogger("out"));

global.WebSocket = WebSocket;

describe("Application", () => {
	jasmine.DEFAULT_TIMEOUT_INTERVAL = 10 * 1000;

	beforeAll(async (done) => {
		const conn = await new AMQPConnectionFactory(config.get("rabbitmq"), logger).newConnection();
		this.amqpConnection = conn;
		const ch = await conn.createChannel();
		this.amqpChannel = ch;
		done();
	});

	afterAll(async (done) => {
		try {
			await this.amqpChannel.close();
			await this.amqpConnection.close();
		} catch (error) {
			done.fail(error);
		}
		done();
	});

	beforeEach((done) => {
		spyOn(ZooKeeper, "Promise").and.callFake(() => {
			return new MockZooKeeper.Promise();
		});
		this.app = new Application();
		this.app.start((err) => {
			if (err) {
				done.fail(err);
				return;
			}
			done();
		});
	});

	afterEach((done) => {
		nock.cleanAll();
		setTimeout(() => {
			this.app.stop((err) => {
				if (err) {
					done.fail(err);
					return;
				}
				done();
			});
		}, 100);
	});

	async function createSessionAndClient(): Promise<{ session: playlogClient.Session; client: playlogClient.Client }> {
		return new Promise<{ session: playlogClient.Session; client: playlogClient.Client }>((resolve, reject) => {
			const session = new playlogClient.Session("ws://localhost" + ":" + config.get("server.port") + "/", {
				socketType: playlogClient.Socket.Type.WebSocket,
			});
			session.open((err) => {
				if (err) {
					return reject(err);
				}
				session.createClient((err, client) => {
					if (err) {
						return reject(err);
					}
					resolve({ session, client: client as playlogClient.Client });
				});
			});
		});
	}

	async function closeClientAndSession(client: playlogClient.Client, session: playlogClient.Session): Promise<{}> {
		return new Promise((resolve, reject) => {
			client.close((err) => {
				session.close((err) => {
					resolve();
				});
			});
		});
	}

	async function assertExchangeAndQueue(amqpCh: any, playId: string): Promise<void> {
		const eventAMQPClient = new playlogAMQP.Event(amqpCh);
		const tickAMQPClient = new playlogAMQP.Tick(amqpCh);
		await eventAMQPClient.assertExchange(playId);
		await eventAMQPClient.assertQueue(playId);
		await tickAMQPClient.assertExchange(playId);
	}

	async function deleteExchangeAndQueue(amqpCh: any, playId: string): Promise<void> {
		const eventAMQPClient = new playlogAMQP.Event(amqpCh);
		const tickAMQPClient = new playlogAMQP.Tick(amqpCh);
		await eventAMQPClient.deleteQueue(playId);
		await eventAMQPClient.deleteExchange(playId);
		await tickAMQPClient.deleteExchange(playId);
	}

	function getTokenExpire(sec?: number): Date {
		const additionalSec = sec || 5;
		return new Date(new Date().getTime() + additionalSec * 1000);
	}

	it("should publish/subscribe ticks and events (1 active client / 1 passive client)", async (done) => {
		const playId = "100";
		new MockSystemControlServer().validateToken(200, {
			id: "1",
			playId,
			meta: { userId: activeUserId },
			value: "active",
			expire: getTokenExpire(),
			writeTick: true,
			readTick: false,
			subscribeTick: false,
			sendEvent: false,
			subscribeEvent: true,
			maxEventPriority: 0,
		});

		const sc1 = await createSessionAndClient();
		const activeSession = sc1.session;
		const activeClient = sc1.client;
		const sc2 = await createSessionAndClient();
		const passiveSession = sc2.session;
		const passiveClient = sc2.client;
		await assertExchangeAndQueue(this.amqpChannel, playId);
		await new Promise((resolve, reject) => {
			activeClient.open(playId, (err) => {
				if (err) {
					return reject(err);
				}
				return resolve();
			});
		});
		await new Promise((resolve, reject) => {
			activeClient.authenticate("active", (err, permission) => {
				if (err) {
					return reject(err);
				}
				expect(permission).toEqual({
					writeTick: true,
					readTick: false,
					sendEvent: false,
					subscribeEvent: true,
					subscribeTick: false,
					maxEventPriority: 0,
				});
				return resolve();
			});
		});
		await new MockSystemControlServer().validateToken(200, {
			id: "2",
			playId,
			meta: { userId: passiveUserId },
			value: "passive",
			expire: getTokenExpire(),
			writeTick: false,
			readTick: true,
			subscribeTick: true,
			sendEvent: true,
			subscribeEvent: false,
			maxEventPriority: 2,
		});
		await new Promise((resolve, reject) => {
			passiveClient.open(playId, (err) => {
				if (err) {
					return reject(err);
				}
				return resolve();
			});
		});
		await new Promise((resolve, reject) => {
			passiveClient.authenticate("passive", (err, permission) => {
				if (err) {
					return reject(err);
				}
				expect(permission).toEqual({
					writeTick: false,
					readTick: true,
					sendEvent: true,
					subscribeEvent: false,
					subscribeTick: true,
					maxEventPriority: 2,
				});
				return resolve();
			});
		});
		await new Promise((resolve) => {
			let eventCount = 0;
			activeClient.onEvent((event) => {
				eventCount++;
				expect(event[1]).toBe(2);
				expect(event[2]).toBe(passiveUserId);
				if (eventCount === 6) {
					resolve();
				}
			});
			passiveClient.onTick((tick) => {
				expect(tick[0] <= 30).toBeTruthy();
				if (tick[0] % 5 === 0) {
					passiveClient.sendEvent([0x20, 3, passiveUserId, tick[0] * 100]);
				}
			});
			let frame = 1;
			const timer = setInterval(() => {
				activeClient.sendTick([frame++]);
				if (frame === 31) {
					clearInterval(timer);
				}
			}, 33);
		});
		await closeClientAndSession(activeClient, activeSession);
		await closeClientAndSession(passiveClient, passiveSession);
		await deleteExchangeAndQueue(this.amqpChannel, playId);
		done();
	});

	it("should raise TokenRevoked error", async (done) => {
		const playId = "100";
		const playTokenId = "2";
		new MockSystemControlServer().validateToken(200, {
			id: playTokenId,
			playId,
			meta: { userId: activeUserId },
			value: "active",
			expire: getTokenExpire(),
			writeTick: true,
			readTick: false,
			subscribeTick: false,
			sendEvent: false,
			subscribeEvent: true,
			maxEventPriority: 0,
		});
		const playTokenAMQPClient = new playTokenAMQP.PlayTokenAMQP(this.amqpChannel);
		const sc = await createSessionAndClient();
		const session = sc.session;
		const client = sc.client;
		await assertExchangeAndQueue(this.amqpChannel, playId);
		await new Promise((resolve, reject) => {
			client.open(playId, (err) => {
				if (err) {
					return reject(err);
				}
				return resolve();
			});
		});
		await new Promise((resolve, reject) => {
			client.authenticate("active", (err, permission) => {
				if (err) {
					return reject(err);
				}
				expect(permission).toEqual({
					writeTick: true,
					readTick: false,
					sendEvent: false,
					subscribeEvent: true,
					subscribeTick: false,
					maxEventPriority: 0,
				});
				return resolve();
			});
		});
		await new MockSystemControlServer().getPlay(200, {
			playId,
			gameCode: "mygame",
		});
		await new Promise((resolve, reject) => {
			new MockStorageServer().get(200, [
				{
					data: "data",
					tag: "tag",
				},
			]);
			client.getStorageData([{ region: 1, regionKey: "foo.bar", userId: activeUserId }], (err, data) => {
				expect(err).toBeFalsy();
				expect(data.length).toBe(1);
				expect(data[0].values[0].data).toBe("data");
				return resolve();
			});
		});
		await playTokenAMQPClient.publish(playTokenAMQP.EventType.Revoke, { id: playTokenId });
		new MockStorageServer().get(200, [
			{
				data: "data",
				tag: "tag",
			},
		]);
		await new Promise((resolve) => {
			setTimeout(() => {
				client.getStorageData([{ region: 1, regionKey: "foo.bar", userId: activeUserId }], (err, data) => {
					expect(err).toBeTruthy();
					expect(err.name).toBe("TokenRevoked");
					closeClientAndSession(client, session)
						.then(() => {
							resolve();
						})
						.catch(done.fail);
				});
			}, 1000);
		});
		await deleteExchangeAndQueue(this.amqpChannel, playId);
		done();
	});

	it("should drop events by limit(1 active client / 1 passive client)", async (done) => {
		const playId = "100";
		new MockSystemControlServer().validateToken(200, {
			id: "1",
			playId,
			meta: { userId: activeUserId },
			value: "active",
			expire: getTokenExpire(),
			writeTick: true,
			readTick: false,
			subscribeTick: false,
			sendEvent: false,
			subscribeEvent: true,
			maxEventPriority: 0,
		});

		const sc1 = await createSessionAndClient();
		const activeSession = sc1.session;
		const activeClient = sc1.client;
		const sc2 = await createSessionAndClient();
		const passiveSession = sc2.session;
		const passiveClient = sc2.client;
		await assertExchangeAndQueue(this.amqpChannel, playId);
		await new Promise((resolve, reject) => {
			activeClient.open(playId, (err) => {
				if (err) {
					return reject(err);
				}
				return resolve();
			});
		});
		await new Promise((resolve, reject) => {
			activeClient.authenticate("active", (err, permission) => {
				if (err) {
					return reject(err);
				}
				expect(permission).toEqual({
					writeTick: true,
					readTick: false,
					sendEvent: false,
					subscribeEvent: true,
					subscribeTick: false,
					maxEventPriority: 0,
				});
				return resolve();
			});
		});
		await new MockSystemControlServer().validateToken(200, {
			id: "2",
			playId,
			meta: { userId: passiveUserId },
			value: "passive",
			expire: getTokenExpire(),
			writeTick: false,
			readTick: true,
			subscribeTick: true,
			sendEvent: true,
			subscribeEvent: false,
			maxEventPriority: 2,
		});
		await new Promise((resolve, reject) => {
			passiveClient.open(playId, (err) => {
				if (err) {
					return reject(err);
				}
				return resolve();
			});
		});
		await new Promise((resolve, reject) => {
			passiveClient.authenticate("passive", (err, permission) => {
				if (err) {
					return reject(err);
				}
				expect(permission).toEqual({
					writeTick: false,
					readTick: true,
					sendEvent: true,
					subscribeEvent: false,
					subscribeTick: true,
					maxEventPriority: 2,
				});
				return resolve();
			});
		});
		await new Promise((resolve) => {
			let sendEventCount = 0;
			let recvEventCount = 0;
			const sendAll = false;
			activeClient.onEvent((event) => {
				recvEventCount++;
				expect(recvEventCount <= 900).toBe(true);
				if (recvEventCount === 600) {
					expect(event[3]).toBe(1299);
				} else if (recvEventCount === 900) {
					expect(event[3]).toBe(2299);
					setTimeout(() => {
						resolve();
					}, 1000);
				}
			});
			for (let i = 0; i < 1000; i++) {
				passiveClient.sendEvent([0x20, 3, passiveUserId, sendEventCount++]);
			}
			setTimeout(() => {
				for (let i = 0; i < 1000; i++) {
					passiveClient.sendEvent([0x20, 3, passiveUserId, sendEventCount++]);
				}
				setTimeout(() => {
					for (let i = 0; i < 1000; i++) {
						passiveClient.sendEvent([0x20, 3, passiveUserId, sendEventCount++]);
					}
				}, 1000);
			}, 1000);
		});
		await closeClientAndSession(activeClient, activeSession);
		await closeClientAndSession(passiveClient, passiveSession);
		await deleteExchangeAndQueue(this.amqpChannel, playId);
		done();
	});

	it("should drop events by userId mismatch", async (done) => {
		const playId = "100";
		new MockSystemControlServer().validateToken(200, {
			id: "1",
			playId,
			meta: { userId: activeUserId },
			value: "active",
			expire: getTokenExpire(),
			writeTick: true,
			readTick: false,
			subscribeTick: false,
			sendEvent: false,
			subscribeEvent: true,
			maxEventPriority: 0,
		});

		const sc1 = await createSessionAndClient();
		const activeSession = sc1.session;
		const activeClient = sc1.client;
		const sc2 = await createSessionAndClient();
		const passiveSession = sc2.session;
		const passiveClient = sc2.client;
		await assertExchangeAndQueue(this.amqpChannel, playId);
		await new Promise((resolve, reject) => {
			activeClient.open(playId, (err) => {
				if (err) {
					return reject(err);
				}
				return resolve();
			});
		});
		await new Promise((resolve, reject) => {
			activeClient.authenticate("active", (err, permission) => {
				if (err) {
					return reject(err);
				}
				expect(permission).toEqual({
					writeTick: true,
					readTick: false,
					sendEvent: false,
					subscribeEvent: true,
					subscribeTick: false,
					maxEventPriority: 0,
				});
				return resolve();
			});
		});
		await new MockSystemControlServer().validateToken(200, {
			id: "2",
			playId,
			meta: { userId: passiveUserId },
			value: "passive",
			expire: getTokenExpire(),
			writeTick: false,
			readTick: true,
			subscribeTick: true,
			sendEvent: true,
			subscribeEvent: false,
			maxEventPriority: 2,
		});
		await new Promise((resolve, reject) => {
			passiveClient.open(playId, (err) => {
				if (err) {
					return reject(err);
				}
				return resolve();
			});
		});
		await new Promise((resolve, reject) => {
			passiveClient.authenticate("passive", (err, permission) => {
				if (err) {
					return reject(err);
				}
				expect(permission).toEqual({
					writeTick: false,
					readTick: true,
					sendEvent: true,
					subscribeEvent: false,
					subscribeTick: true,
					maxEventPriority: 2,
				});
				return resolve();
			});
		});
		await new Promise((resolve, reject) => {
			let eventCount = 0;
			activeClient.onEvent((event) => {
				expect(event[0]).toEqual(0x20);
				eventCount++;
				if (eventCount === 100) {
					resolve();
				}
			});
			for (let i = 0; i < 100; i++) {
				passiveClient.sendEvent([0x20, 3, passiveUserId, 1]);
			}
			for (let i = 0; i < 100; i++) {
				passiveClient.sendEvent([0x21, 3, "1024", 1]);
			}
		});
		await closeClientAndSession(activeClient, activeSession);
		await closeClientAndSession(passiveClient, passiveSession);
		await deleteExchangeAndQueue(this.amqpChannel, playId);
		done();
	});

	it("should complement userId in events if empty", async (done) => {
		const playId = "100";
		new MockSystemControlServer().validateToken(200, {
			id: "1",
			playId,
			meta: { userId: activeUserId },
			value: "active",
			expire: getTokenExpire(),
			writeTick: true,
			readTick: false,
			subscribeTick: false,
			sendEvent: false,
			subscribeEvent: true,
			maxEventPriority: 0,
		});
		const sc1 = await createSessionAndClient();
		const activeSession = sc1.session;
		const activeClient = sc1.client;
		const sc2 = await createSessionAndClient();
		const passiveSession = sc2.session;
		const passiveClient = sc2.client;
		await assertExchangeAndQueue(this.amqpChannel, playId);
		await new Promise((resolve, reject) => {
			activeClient.open(playId, (err) => {
				if (err) {
					return reject(err);
				}
				return resolve();
			});
		});
		await new Promise((resolve, reject) => {
			activeClient.authenticate("active", (err, permission) => {
				if (err) {
					return reject(err);
				}
				expect(permission).toEqual({
					writeTick: true,
					readTick: false,
					sendEvent: false,
					subscribeEvent: true,
					subscribeTick: false,
					maxEventPriority: 0,
				});
				return resolve();
			});
		});
		await new MockSystemControlServer().validateToken(200, {
			id: "2",
			playId,
			meta: { userId: passiveUserId },
			value: "passive",
			expire: getTokenExpire(),
			writeTick: false,
			readTick: true,
			subscribeTick: true,
			sendEvent: true,
			subscribeEvent: false,
			maxEventPriority: 2,
		});
		await new Promise((resolve, reject) => {
			passiveClient.open(playId, (err) => {
				if (err) {
					return reject(err);
				}
				return resolve();
			});
		});
		await new Promise((resolve, reject) => {
			passiveClient.authenticate("passive", (err, permission) => {
				if (err) {
					return reject(err);
				}
				expect(permission).toEqual({
					writeTick: false,
					readTick: true,
					sendEvent: true,
					subscribeEvent: false,
					subscribeTick: true,
					maxEventPriority: 2,
				});
				return resolve();
			});
		});
		await new Promise((resolve, reject) => {
			let eventCount = 0;
			activeClient.onEvent((event) => {
				expect(event[2]).toEqual(passiveUserId);
				eventCount++;
				if (eventCount === 100) {
					resolve();
				}
			});
			for (let i = 0; i < 100; i++) {
				(passiveClient as any).sendEvent([0x21, 3, null, 1]); // NOTE: Event[2] is not nullable
			}
		});
		await closeClientAndSession(activeClient, activeSession);
		await closeClientAndSession(passiveClient, passiveSession);
		await deleteExchangeAndQueue(this.amqpChannel, playId);
		done();
	});

	it("should drop ticks and events by revoking active client token", async (done) => {
		const playId = "100";
		const activePlayTokenId = "1";
		const passivePlayTokenId = "2";
		new MockSystemControlServer().validateToken(200, {
			id: activePlayTokenId,
			playId,
			meta: { userId: activeUserId },
			value: "active",
			expire: getTokenExpire(),
			writeTick: true,
			readTick: false,
			subscribeTick: false,
			sendEvent: false,
			subscribeEvent: true,
			maxEventPriority: 0,
		});
		const playTokenAMQPClient = new playTokenAMQP.PlayTokenAMQP(this.amqpChannel);

		const sc1 = await createSessionAndClient();
		const activeSession = sc1.session;
		const activeClient = sc1.client;
		const sc2 = await createSessionAndClient();
		const passiveSession = sc2.session;
		const passiveClient = sc2.client;
		await assertExchangeAndQueue(this.amqpChannel, playId);
		await new Promise((resolve, reject) => {
			activeClient.open(playId, (err) => {
				if (err) {
					return reject(err);
				}
				return resolve();
			});
		});
		await new Promise((resolve, reject) => {
			activeClient.authenticate("active", (err, permission) => {
				if (err) {
					return reject(err);
				}
				expect(permission).toEqual({
					writeTick: true,
					readTick: false,
					sendEvent: false,
					subscribeEvent: true,
					subscribeTick: false,
					maxEventPriority: 0,
				});
				return resolve();
			});
		});
		await new MockSystemControlServer().validateToken(200, {
			id: passivePlayTokenId,
			playId,
			meta: { userId: passiveUserId },
			value: "passive",
			expire: getTokenExpire(),
			writeTick: false,
			readTick: true,
			subscribeTick: true,
			sendEvent: true,
			subscribeEvent: false,
			maxEventPriority: 2,
		});
		await new Promise((resolve, reject) => {
			passiveClient.open(playId, (err) => {
				if (err) {
					return reject(err);
				}
				return resolve();
			});
		});
		await new Promise((resolve, reject) => {
			passiveClient.authenticate("passive", (err, permission) => {
				if (err) {
					return reject(err);
				}
				expect(permission).toEqual({
					writeTick: false,
					readTick: true,
					sendEvent: true,
					subscribeEvent: false,
					subscribeTick: true,
					maxEventPriority: 2,
				});
				return resolve();
			});
		});
		await new Promise((resolve) => {
			let eventCount = 0;
			activeClient.onEvent((event) => {
				eventCount++;
				expect(eventCount).toBeLessThan(31);
				expect(event[1]).toBe(2);
				expect(event[2]).toBe(passiveUserId);
			});
			passiveClient.onTick((tick) => {
				expect(tick[0]).toBeLessThan(31);
			});
			let frame = 0;
			const timer1 = setInterval(() => {
				frame++;
				activeClient.sendTick([frame]);
				passiveClient.sendEvent([0x20, 3, passiveUserId, frame * 100]);
				if (frame === 30) {
					playTokenAMQPClient.publish(playTokenAMQP.EventType.Revoke, { id: activePlayTokenId }); // 以降のtick送信とevent受信は無効
				}
				if (frame === 40) {
					clearInterval(timer1);
					setTimeout(() => {
						resolve();
					}, 1000);
				}
			}, 33);
		});
		await closeClientAndSession(activeClient, activeSession);
		await closeClientAndSession(passiveClient, passiveSession);
		await deleteExchangeAndQueue(this.amqpChannel, playId);
		done();
	});

	it("should drop ticks and events by revoking passive client token", async (done) => {
		const playId = "100";
		const activePlayTokenId = "1";
		const passivePlayTokenId = "2";
		new MockSystemControlServer().validateToken(200, {
			id: activePlayTokenId,
			playId,
			meta: { userId: activeUserId },
			value: "active",
			expire: getTokenExpire(),
			writeTick: true,
			readTick: false,
			subscribeTick: false,
			sendEvent: false,
			subscribeEvent: true,
			maxEventPriority: 0,
		});
		const playTokenAMQPClient = new playTokenAMQP.PlayTokenAMQP(this.amqpChannel);

		const sc1 = await createSessionAndClient();
		const activeSession = sc1.session;
		const activeClient = sc1.client;
		const sc2 = await createSessionAndClient();
		const passiveSession = sc2.session;
		const passiveClient = sc2.client;
		await assertExchangeAndQueue(this.amqpChannel, playId);
		await new Promise((resolve, reject) => {
			activeClient.open(playId, (err) => {
				if (err) {
					return reject(err);
				}
				return resolve();
			});
		});
		await new Promise((resolve, reject) => {
			activeClient.authenticate("active", (err, permission) => {
				if (err) {
					return reject(err);
				}
				expect(permission).toEqual({
					writeTick: true,
					readTick: false,
					sendEvent: false,
					subscribeEvent: true,
					subscribeTick: false,
					maxEventPriority: 0,
				});
				return resolve();
			});
		});
		await new MockSystemControlServer().validateToken(200, {
			id: passivePlayTokenId,
			playId,
			meta: { userId: passiveUserId },
			value: "passive",
			expire: getTokenExpire(),
			writeTick: false,
			readTick: true,
			subscribeTick: true,
			sendEvent: true,
			subscribeEvent: false,
			maxEventPriority: 2,
		});
		await new Promise((resolve, reject) => {
			passiveClient.open(playId, (err) => {
				if (err) {
					return reject(err);
				}
				return resolve();
			});
		});
		await new Promise((resolve, reject) => {
			passiveClient.authenticate("passive", (err, permission) => {
				if (err) {
					return reject(err);
				}
				expect(permission).toEqual({
					writeTick: false,
					readTick: true,
					sendEvent: true,
					subscribeEvent: false,
					subscribeTick: true,
					maxEventPriority: 2,
				});
				return resolve();
			});
		});
		await new Promise((resolve) => {
			let eventCount = 0;
			activeClient.onEvent((event) => {
				eventCount++;
				expect(eventCount).toBeLessThan(31);
				expect(event[1]).toBe(2);
				expect(event[2]).toBe(passiveUserId);
			});
			passiveClient.onTick((tick) => {
				expect(tick[0]).toBeLessThan(31);
			});
			let frame = 0;
			const timer1 = setInterval(() => {
				frame++;
				activeClient.sendTick([frame]);
				passiveClient.sendEvent([0x20, 3, passiveUserId, frame * 100]);
				if (frame === 30) {
					playTokenAMQPClient.publish(playTokenAMQP.EventType.Revoke, { id: passivePlayTokenId }); // 以降のtick受信とevent送信は無効
				}
				if (frame === 40) {
					clearInterval(timer1);
					setTimeout(() => {
						resolve();
					}, 1000);
				}
			}, 33);
		});
		await closeClientAndSession(activeClient, activeSession);
		await closeClientAndSession(passiveClient, passiveSession);
		await deleteExchangeAndQueue(this.amqpChannel, playId);
		done();
	});
});
