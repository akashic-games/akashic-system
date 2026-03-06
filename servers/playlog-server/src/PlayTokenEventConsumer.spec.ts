import { LogUtil } from "@akashic/log-util";
import * as playTokenAMQP from "@akashic/playtoken-amqp";
import * as amqp from "amqplib";
import config from "config";
import * as log4js from "log4js";
import { AMQPConnectionFactory } from "./AMQPConnectionFactory";
import { PlayTokenEventConsumer } from "./PlayTokenEventConsumer";

describe("PlayTokenEventConsumer", () => {
	let eventConsumer;
	let amqpConnectionFactory;
	let amqpConnection;
	let amqpChannel;
	let playTokenAMQPClient;
	const logger = new LogUtil(log4js.getLogger("out"));

	beforeAll(async () => {
		amqpConnectionFactory = new AMQPConnectionFactory(config.get("rabbitmq"), logger);
		const conn = await amqpConnectionFactory.newConnection();
		amqpConnection = conn;
		const ch = await conn.createChannel();
		amqpChannel = ch;
		playTokenAMQPClient = new playTokenAMQP.PlayTokenAMQP(ch);
		await playTokenAMQPClient.assertExchange();
	});

	afterAll(async () => {
		await amqpChannel.close();
		await amqpConnection.close();
	});

	beforeEach(async () => {
		eventConsumer = new PlayTokenEventConsumer(amqpConnectionFactory, logger);
		await eventConsumer.open();
	});

	afterEach(async () => {
		await eventConsumer.close();
	});

	it("should notify play token revoke request", (done) => {
		const revokeReq = {
			id: "42",
			playId: "100",
			userId: "200",
		};
		eventConsumer.on("revoke", (req, ack) => {
			expect(req).toEqual(revokeReq);
			ack();
			done();
		});
		playTokenAMQPClient.publish(playTokenAMQP.EventType.Revoke, revokeReq);
	});

	it("should notify play token update-permission request", (done) => {
		const permission = {
			writeTick: true,
			readTick: true,
			subscribeTick: true,
			sendEvent: true,
			subscribeEvent: true,
			maxEventPriority: 1,
		};

		const updatePermissionReq = {
			userId: "200",
			permission,
		};
		eventConsumer.on("updatePermission", (req, ack) => {
			expect(req).toEqual(updatePermissionReq);
			ack();
			done();
		});
		playTokenAMQPClient.publish(playTokenAMQP.EventType.UpdatePermission, updatePermissionReq);
	});
});
