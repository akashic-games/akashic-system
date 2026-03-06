import { LogUtil } from "@akashic/log-util";
import * as playTokenAMQP from "@akashic/playtoken-amqp";
import config from "config";
import * as log4js from "log4js";
import { AMQPConnectionFactory } from "./AMQPConnectionFactory";
import { PlaylogServerControlEventConsumer } from "./PlaylogServerControlEventConsumer";

describe("PlaylogServerControlEventConsumer", () => {
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
		eventConsumer = new PlaylogServerControlEventConsumer(amqpConnectionFactory, logger);
		await eventConsumer.open();
	});

	afterEach(async () => {
		await eventConsumer.close();
	});

	it("should notify playlog server cache purge request", (done) => {
		const purgeReq: playTokenAMQP.PlayToken = {
			playId: "100",
		};
		eventConsumer.on("purge", (req, ack) => {
			expect(req).toEqual(purgeReq.playId);
			ack();
			done();
		});
		playTokenAMQPClient.publish(playTokenAMQP.EventType.Purge, purgeReq);
	});
});
