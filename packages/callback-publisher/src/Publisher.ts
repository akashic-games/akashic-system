import { AmqpConnectionManager } from "@akashic/amqp-utils";
import * as amqp from "amqplib";
import * as Constants from "./Constants";
import { Event } from "./Event";

export class Publisher {
	private _amqpConnectionManager: AmqpConnectionManager;

	constructor(amqpConnectionManager: AmqpConnectionManager) {
		this._amqpConnectionManager = amqpConnectionManager;
	}

	public setup(): Promise<void> {
		const exchangeOpts: amqp.Options.AssertExchange = {
			durable: true,
			autoDelete: false,
		};
		const queueOpts: amqp.Options.AssertQueue = {
			exclusive: false,
			autoDelete: false,
		};
		return this._amqpConnectionManager.doChannelTask(async (ch) => {
			await ch.assertExchange(Constants.exchange, "topic", exchangeOpts);
			await ch.assertQueue(Constants.queue, queueOpts);
			await ch.bindQueue(Constants.queue, Constants.exchange, "*");
		});
	}

	public publish<T>(name: string, content: Event<T>): Promise<void> {
		return this._amqpConnectionManager.publish(Constants.exchange, name, content.toBuffer(), { persistent: true });
	}
}
