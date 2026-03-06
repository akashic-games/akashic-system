import {
	tickDlxName,
	startPointDlxName,
	tickStoreDeadLetterQueueName,
	startPointStoreDeadLetterQueueName,
	getQueueNames,
} from "./constants";
import type { Options, Channel, Replies } from "amqplib";

/**
 * dead letter exchangeとキューの作成の共通処理
 */
export async function prepareDlx(channel: Channel): Promise<void> {
	// dead letterのexchangeとキュー作成
	const dlxOptions: Options.AssertExchange = {
		durable: true,
		autoDelete: false,
	};
	const queueOptions: Options.AssertQueue = {
		durable: true,
		autoDelete: false,
		exclusive: false,
	};
	await channel.assertExchange(tickDlxName, "fanout", dlxOptions);
	await channel.assertExchange(startPointDlxName, "fanout", dlxOptions);
	await channel.assertQueue(tickStoreDeadLetterQueueName, queueOptions);
	await channel.assertQueue(startPointStoreDeadLetterQueueName, queueOptions);
	await channel.bindQueue(tickStoreDeadLetterQueueName, tickDlxName, "");
	await channel.bindQueue(startPointStoreDeadLetterQueueName, startPointDlxName, "");
}

export async function prepareStoreQueue(
	channel: Channel,
	playId: string,
): Promise<{ tickStoreQueue: Replies.AssertQueue; startPointStoreQueue: Replies.AssertQueue }> {
	const { tickStoreQueueName, startPointStoreQueueName } = getQueueNames(playId);
	// 保存用キューの作成
	const storageQueueOptions: Options.AssertQueue = {
		durable: true,
		autoDelete: false,
		exclusive: false,
	};
	const tickStoreQueue = await channel.assertQueue(tickStoreQueueName, { ...storageQueueOptions, deadLetterExchange: tickDlxName });
	const startPointStoreQueue = await channel.assertQueue(startPointStoreQueueName, {
		...storageQueueOptions,
		deadLetterExchange: startPointDlxName,
	});
	return { tickStoreQueue, startPointStoreQueue };
}
