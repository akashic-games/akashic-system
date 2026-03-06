import { AmqpConnectionManager } from "@akashic/amqp-utils";
import config from "config";
import { EventEmitter } from "events";
import {
	INSTANCE_REQUEST_EXCHANGE,
	INSTANCE_REQUEST_QUEUE,
	InstanceRequestConsumer,
	InstanceRequestMessageType,
	InstanceRequestPublisher,
} from "./";

describe("InstanceRequestPublisher and InstanceRequestConsumer", () => {
	let amqpConnectionManager!: AmqpConnectionManager;
	let publisher!: InstanceRequestPublisher;
	let emitter!: EventEmitter; // consumer からのメッセージ受け取り用
	let consumer!: InstanceRequestConsumer;

	beforeEach(async () => {
		const urls = config.get<string[]>("rabbitmq.url");
		const user = config.get<string>("rabbitmq.user");
		const password = config.get<string>("rabbitmq.passwd");
		amqpConnectionManager = new AmqpConnectionManager({
			urls,
			user,
			password,
		});
		await amqpConnectionManager.init();

		// キューにメッセージが残っていると正しくテストできないのでキューごと消しておく
		amqpConnectionManager.doChannelTask(async (ch) => {
			await ch.deleteQueue(INSTANCE_REQUEST_QUEUE).catch(() => undefined);
		});

		publisher = new InstanceRequestPublisher(amqpConnectionManager);
		await publisher.setup();

		emitter = new EventEmitter();
		consumer = new InstanceRequestConsumer(amqpConnectionManager, (msg) => {
			emitter.emit("message", msg);
			return true;
		});
		await consumer.start();
	});

	afterEach(async () => {
		if (consumer) {
			await consumer.stop().catch(() => undefined);
		}
		if (amqpConnectionManager) {
			await amqpConnectionManager.close().catch(() => undefined);
		}
	});

	it("can publish and consumer start request", (done) => {
		const instanceId = "25";
		emitter.once("message", (msg) => {
			expect(msg.type).toEqual(InstanceRequestMessageType.Start);
			expect(msg.instanceId).toEqual(instanceId);
			setImmediate(done);
		});

		publisher.requestStartInstance(instanceId);
	});

	it("can publish and consumer stop request", (done) => {
		const instanceId = "42";
		emitter.once("message", (msg) => {
			expect(msg.type).toEqual(InstanceRequestMessageType.Stop);
			expect(msg.instanceId).toEqual(instanceId);
			setImmediate(done);
		});

		publisher.requestStopInstance(instanceId);
	});

	it("can publish and consumer pause request", (done) => {
		const instanceId = "2525";
		emitter.once("message", (msg) => {
			expect(msg.type).toEqual(InstanceRequestMessageType.Pause);
			expect(msg.instanceId).toEqual(instanceId);
			setImmediate(done);
		});

		publisher.requestPauseInstance(instanceId);
	});

	it("can publish and consumer resume request", (done) => {
		const instanceId = "4242";
		emitter.once("message", (msg) => {
			expect(msg.type).toEqual(InstanceRequestMessageType.Resume);
			expect(msg.instanceId).toEqual(instanceId);
			setImmediate(done);
		});

		publisher.requestResumeInstance(instanceId);
	});

	it("ignore invalid message", (done) => {
		emitter.once("message", () => {
			setImmediate(done.fail);
		});
		consumer.once("unhandledMessage", () => {
			setImmediate(done);
		});

		amqpConnectionManager.publish(INSTANCE_REQUEST_EXCHANGE, InstanceRequestMessageType.Start, Buffer.from("invalid data"));
	});

	it("ignore message with invalid request type", (done) => {
		emitter.once("message", () => {
			setImmediate(done.fail);
		});
		consumer.once("unhandledMessage", () => {
			setImmediate(done);
		});

		amqpConnectionManager.publishObject(INSTANCE_REQUEST_EXCHANGE, InstanceRequestMessageType.Start, {
			instanceId: "42",
			type: true,
		});
	});

	it("ignore message with invalid instanceId", (done) => {
		emitter.once("message", () => {
			setImmediate(done.fail);
		});
		consumer.once("unhandledMessage", () => {
			setImmediate(done);
		});

		publisher.requestStartInstance(true as any);
	});
});
