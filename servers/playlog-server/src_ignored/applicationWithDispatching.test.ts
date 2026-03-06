import * as lu from "@akashic/log-util";
import * as playlogAMQP from "@akashic/playlog-amqp";
import { Client as PlaylogClient, Socket as ClientSocket } from "@akashic/playlog-client";
import * as amqp from "amqplib";
import config from "config";
import * as log4js from "log4js";
import * as nock from "nock";
import * as ZooKeeper from "@akashic/zookeeper";
import { Application } from "./";
import { AMQPConnectionFactory } from "./AMQPConnectionFactory";
import Constants from "./Constants";
import MockSystemControlServer from "./MockSystemControlServer";
import * as MockZooKeeper from "./MockZooKeeper";

const activeUserId = Constants.activeUserId;
const passiveUserId = Constants.passiveUserId;

const request = require("request-promise");

const baseUrl = "http://localhost:" + config.get("server.port") + "/";

const logger = new lu.LogUtil(log4js.getLogger("out"));

xdescribe("Application enabled dispatcher support", () => {
	jasmine.DEFAULT_TIMEOUT_INTERVAL = 10 * 1000;

	beforeAll(async (done) => {
		const conn = await new AMQPConnectionFactory(config.get("rabbitmq"), logger).newConnection();
		this.amqpConnection = conn;
		const ch = await conn.createChannel();
		this.amqpChannel = ch;
		done();
	});

	afterAll(async (done) => {
		await this.amqpChannel.close();
		await this.amqpConnection.close();
		done();
	});

	beforeEach((done) => {
		spyOn(ZooKeeper, "Promise").and.callFake(() => {
			return new MockZooKeeper.Promise();
		});
		this.app = new Application({
			dispatcherConfig: {
				processId: "1",
				trait: "ws",
				endpoint: baseUrl,
				maxClients: 100,
				clusterName: "",
				reservationEndpoint: "",
				reservationExpire: 2,
				reservationPort: 2,
			},
			port: config.get("server.port"),
		});
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

	it("should reserve", async (done) => {
		const playId = "100";
		const token = "mytoken";
		expect(this.app._sessionManager._reserved[playId]).toBeFalsy();
		const res = await request({
			url: baseUrl + "v1.0/dispatched_plays/100/reservations",
			method: "POST",
			json: { playToken: token },
			resolveWithFullResponse: true,
		});
		expect(this.app._sessionManager._reserved[playId][token]).toBeTruthy();
		done();
	});

	// NOTE: applicationSpec.jsからのコピー。ちゃんと動くことを確認する。そのうち消すかも。
	it("should publish/subscribe ticks and events (1 active client / 1 passive client)", async (done) => {
		const playId = "100";
		this.app._sessionManager.reserve(playId, "passive");
		this.app._sessionManager.reserve(playId, "active");
		let activeClient;
		let passiveClient;
		new MockSystemControlServer().validateToken(200, {
			id: "1",
			playId,
			meta: { userId: activeUserId },
			value: "active",
			expire: new Date(),
			writeTick: true,
			readTick: false,
			subscribeTick: false,
			sendEvent: false,
			subscribeEvent: true,
			maxEventPriority: 0,
		});
		const client = new amqp.Client();
		activeClient = new PlaylogClient(client, undefined, undefined);
		passiveClient = new PlaylogClient(client, undefined, undefined);

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
			expire: new Date(),
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
		await new Promise((resolve) => {
			activeClient.close((err) => {
				expect(err).toBeFalsy();
				passiveClient.close((err) => {
					expect(err).toBeFalsy();
					resolve();
				});
			});
		});
		await deleteExchangeAndQueue(this.amqpChannel, playId);
		done();
	});
});
