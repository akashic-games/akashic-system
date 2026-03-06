import { AmqpConnectionManager } from "@akashic/amqp-utils";
import * as cb from "@akashic/callback-publisher";
import { Constants } from "@akashic/server-engine-data-types";
import config from "config";
import { InstanceConsumer } from "./event/instanceEvent/InstanceConsumer";
import { AmqpConsumer, AmqpConsumerConfig } from "./util/AmqpConsumer";
import { LogFactory } from "./util/LogFactory";

class DummyNotifier {
	public instanceId!: string;
	public eventName!: string;
	public content: any;

	public fire(instanceId: string, eventName: string, content: any, _warn: () => void): Promise<void> {
		this.instanceId = instanceId;
		this.eventName = eventName;
		this.content = content;
		return Promise.resolve(undefined);
	}
}

// 環境によって通ったり落ちたりするので、無効化。
xdescribe("InstanceConsumer", () => {
	const amqpConfig = config.get<AmqpConsumerConfig>("rabbitmq");
	const logFactory = new LogFactory();

	async function publish<T>(event: cb.Event<T>): Promise<void> {
		const amqpConnectionManager = new AmqpConnectionManager({
			urls: amqpConfig.url,
			user: amqpConfig.user,
			password: amqpConfig.passwd,
		});
		await amqpConnectionManager.init();
		const publisher = new cb.Publisher(amqpConnectionManager);
		await publisher.publish(event.type, event);
		await amqpConnectionManager.close();
	}

	it("can consume instanceStatusChange event", (done: Function) => {
		const instanceStatus: cb.Instance = {
			instanceId: "12345",
			status: "running",
		};
		const event = new cb.Event<cb.Instance>({
			category: cb.EventCategory.Info,
			type: Constants.EVENT_HANDLER_TYPE_INSTANCE_STATUS,
			payload: instanceStatus,
		});
		const dummyNotifier = new DummyNotifier();
		const amqpConsumer = new AmqpConsumer(amqpConfig);
		InstanceConsumer.consume(amqpConsumer, dummyNotifier as any, null, logFactory.getLogger("out"));
		amqpConsumer
			.open()
			.then(() => publish(event))
			.then(() => {
				return new Promise<void>((resolve) => {
					setTimeout(() => {
						amqpConsumer.close();
						resolve();
					}, 1000);
				});
			})
			.then(() => {
				expect(dummyNotifier.instanceId).toEqual(event.payload?.instanceId);
				expect(dummyNotifier.eventName).toEqual(event.type);
				expect(dummyNotifier.content).toEqual(event);
				done();
			});
	});

	it("can consume instance error event", (done: Function) => {
		const instanceError: cb.InstanceError = {
			instanceId: "54321",
			code: 1,
			description: "some error occured",
		};
		const event = new cb.Event<cb.InstanceError>({
			category: cb.EventCategory.Error,
			type: Constants.EVENT_HANDLER_TYPE_ERROR,
			payload: instanceError,
		});
		const dummyNotifier = new DummyNotifier();
		const amqpConsumer = new AmqpConsumer(amqpConfig);
		InstanceConsumer.consume(amqpConsumer, dummyNotifier as any, null, logFactory.getLogger("out"));
		amqpConsumer
			.open()
			.then(() => publish(event))
			.then(() => {
				return new Promise<void>((resolve) => {
					setTimeout(() => {
						amqpConsumer.close();
						resolve();
					}, 1000);
				});
			})
			.then(() => {
				expect(dummyNotifier.instanceId).toEqual(event.payload?.instanceId);
				expect(dummyNotifier.eventName).toEqual(event.type);
				expect(dummyNotifier.content).toEqual(event);
				done();
			});
	});

	it("can consume game event", (done: Function) => {
		const gameEvent: cb.GameEvent = {
			playId: "424242",
			instanceId: "242424",
			type: "message from game content",
			data: { message: "some game event occured" },
		};
		const event = new cb.Event<cb.GameEvent>({
			category: cb.EventCategory.Info,
			type: Constants.EVENT_HANDLER_TYPE_GAME_EVENT,
			payload: gameEvent,
		});
		const dummyNotifier = new DummyNotifier();
		const amqpConsumer = new AmqpConsumer(amqpConfig);
		InstanceConsumer.consume(amqpConsumer, dummyNotifier as any, null, logFactory.getLogger("out"));
		amqpConsumer
			.open()
			.then(() => publish(event))
			.then(() => {
				return new Promise<void>((resolve) => {
					setTimeout(() => {
						amqpConsumer.close();
						resolve();
					}, 1000);
				});
			})
			.then(() => {
				expect(dummyNotifier.instanceId).toEqual(event.payload?.instanceId);
				expect(dummyNotifier.eventName).toEqual(event.type);
				expect(dummyNotifier.content).toEqual(event);
				done();
			});
	});
});
