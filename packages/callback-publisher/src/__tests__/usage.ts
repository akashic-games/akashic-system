import { AmqpConnectionManager } from "@akashic/amqp-utils";
import { Constants, Event, EventCategory, Instance, InstanceError, Publisher } from "../";

import config from "config";

test.todo("callback-publisher usage");

describe("usage in akashic-cluster-master", () => {
	test("publish error instance", async () => {
		const errorInstance: InstanceError = {
			instanceId: "test_instance_id",
			code: 1,
		};
		const errorEvent = new Event<InstanceError>({
			category: EventCategory.Error,
			type: "error",
			payload: errorInstance,
		});

		const amqpConnectionManager = new AmqpConnectionManager({
			urls: config.get<string[]>("rabbitmq.url"),
			user: config.get<string>("rabbitmq.user"),
			password: config.get<string>("rabbitmq.passwd"),
		});
		const publisher = new Publisher(amqpConnectionManager);

		await amqpConnectionManager.init();
		await publisher.setup();
		await publisher.publish("error", errorEvent);
	});

	test("publish instance", async () => {
		const gameInstance: Instance = {
			instanceId: "test_instance_id",
			status: "running",
		};
		const event = new Event<Instance>({
			category: EventCategory.Info,
			type: "instanceStatus",
			payload: gameInstance,
		});

		const amqpConnectionManager = new AmqpConnectionManager({
			urls: config.get<string[]>("rabbitmq.url"),
			user: config.get<string>("rabbitmq.user"),
			password: config.get<string>("rabbitmq.passwd"),
		});
		const publisher = new Publisher(amqpConnectionManager);

		await amqpConnectionManager.init();
		await publisher.setup();
		await publisher.publish("instanceStatus", event);
	});
});

describe("usage in conduct-worker", () => {
	test("referred some constants", () => {
		expect(Constants.exchange).not.toBeUndefined();
		expect(Constants.queue).not.toBeUndefined();
	});
});
