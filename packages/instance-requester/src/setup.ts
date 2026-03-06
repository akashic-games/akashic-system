import { AmqpConnectionManager } from "@akashic/amqp-utils";
import * as constants from "./constants";

export async function setup(amqpConnectionManager: AmqpConnectionManager): Promise<void> {
	await amqpConnectionManager.doChannelTask(async (ch) => {
		await ch.assertExchange(constants.INSTANCE_REQUEST_EXCHANGE, "topic", { durable: true, autoDelete: false });
		await ch.assertQueue(constants.INSTANCE_REQUEST_QUEUE, { exclusive: false, autoDelete: false });
		await ch.bindQueue(constants.INSTANCE_REQUEST_QUEUE, constants.INSTANCE_REQUEST_EXCHANGE, "*");
	});
}
