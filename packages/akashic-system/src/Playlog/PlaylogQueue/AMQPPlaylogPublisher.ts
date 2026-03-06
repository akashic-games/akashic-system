import { encodeTick, encodeStartPoint, encodeEvent } from "@akashic/amflow-message";
import { NullLogger } from "@akashic-system/logger";
import { getExchangeNames, getQueueNames, EVENT_MAX_PRIORITY, EVENT_NON_MAX_PRIORITY_EVENT_TTL, playIdHeaderName } from "./constants";
import { prepareDlx, prepareStoreQueue } from "./prepares";

import type { Options } from "amqplib";
import type { Tick, Event } from "@akashic/playlog";
import type { StartPoint } from "@akashic/amflow";
import type { AmqpChannelHolder } from "@akashic/amqp-utils";
import type { IPlaylogPublisher } from "./IPlaylogPublisher";
import type { ILogger } from "@akashic-system/logger";

export class AMQPPlaylogPublisher implements IPlaylogPublisher {
	private readonly channelHolder: AmqpChannelHolder;
	public logger: ILogger = new NullLogger();

	constructor(channelHolder: AmqpChannelHolder) {
		this.channelHolder = channelHolder;
	}

	async start(): Promise<void> {
		const channel = await this.channelHolder.getChannel();
		await prepareDlx(channel);
	}

	async stop(): Promise<void> {
		// 停止するものは無い
	}

	async prepare(playId: string): Promise<void> {
		await this.logger.trace(`preparing publish. playId: ${playId}`);
		const { tickBroadcastExchangeName, tickStoreExchangeName, startPointStoreExchangeName, eventExchangeName } = getExchangeNames(playId);
		const { tickStoreQueueName, startPointStoreQueueName, eventQueueName } = getQueueNames(playId);
		const channel = await this.channelHolder.getChannel();
		await prepareDlx(channel);

		// exchangeの作成
		const assertExchangeOptions: Options.AssertExchange = {
			durable: false,
			autoDelete: false,
		};
		await channel.assertExchange(tickBroadcastExchangeName, "fanout", assertExchangeOptions);
		await channel.assertExchange(tickStoreExchangeName, "fanout", assertExchangeOptions);
		await channel.assertExchange(startPointStoreExchangeName, "fanout", assertExchangeOptions);
		await channel.assertExchange(eventExchangeName, "fanout", assertExchangeOptions);

		// イベント用のキューの作成
		const eventQueueOptions = {
			durable: false,
			autoDelete: false,
			maxPriority: EVENT_MAX_PRIORITY,
		};
		await channel.assertQueue(eventQueueName, eventQueueOptions);

		// 保存用キューの作成
		await prepareStoreQueue(channel, playId);

		// キューとexchangeのバインディング
		await channel.bindQueue(eventQueueName, eventExchangeName, "");
		await channel.bindQueue(tickStoreQueueName, tickStoreExchangeName, "");
		await channel.bindExchange(tickBroadcastExchangeName, tickStoreExchangeName, "");
		await channel.bindQueue(startPointStoreQueueName, startPointStoreExchangeName, "");
		await this.logger.trace(`prepare publish finished. playId: ${playId}`);
	}

	async cleanup(playId: string): Promise<void> {
		await this.logger.trace(`cleanup queue and temporary exchange. playId: ${playId}`);
		const { tickBroadcastExchangeName, tickStoreExchangeName, startPointStoreExchangeName, eventExchangeName } = getExchangeNames(playId);
		const { eventQueueName } = getQueueNames(playId);
		const channel = await this.channelHolder.getChannel();
		await channel.deleteExchange(tickStoreExchangeName);
		await channel.deleteExchange(tickBroadcastExchangeName);
		await channel.deleteExchange(startPointStoreExchangeName);
		await channel.deleteExchange(eventExchangeName);
		await channel.deleteQueue(eventQueueName);
		// 保存用キューはここでは削除しない。削除するのはplaylog-store-worker側の責務
	}

	async publishTick(playId: string, tick: Tick): Promise<void> {
		const content = encodeTick(tick);
		await this.publishRawTick(playId, content);
	}

	async publishRawTick(playId: string, content: Buffer): Promise<void> {
		const { tickStoreExchangeName } = getExchangeNames(playId);
		const channel = await this.channelHolder.getChannel();

		const options: Options.Publish = {
			persistent: true,
			headers: {
				// dead-letter時にどのplayIdが分かるようにplayIdを付与
				[playIdHeaderName]: playId,
			},
		};
		channel.publish(tickStoreExchangeName, "", content, options);
	}

	async publishStartPoint(playId: string, startPoint: StartPoint): Promise<void> {
		const { startPointStoreExchangeName } = getExchangeNames(playId);
		const channel = await this.channelHolder.getChannel();

		const options: Options.Publish = {
			persistent: true,
			headers: {
				// dead-letter時にどのplayIdが分かるようにplayIdを付与
				[playIdHeaderName]: playId,
			},
		};
		const content = encodeStartPoint(startPoint);
		channel.publish(startPointStoreExchangeName, "", content, options);
	}

	async publishEvent(playId: string, event: Event): Promise<void> {
		const { eventExchangeName } = getExchangeNames(playId);
		const channel = await this.channelHolder.getChannel();

		// eventのpriorityにNaNが入る現象が発見されたので、エラーになるのを回避しつつ、中身をログに出す
		if (Number.isNaN(event[1])) {
			// TODO: 状況によってはログの大量出力の可能性あり(可能性低)
			await this.logger.warn(`found priority === NaN event. playId: ${playId} event: ${event}`);
			event[1] = 0; // NaNをamqpに入れるとエラーになるので、0で上書き
		}

		// eventはpersistentが無い代わりにpriorityとそれに合わせたeventのexpirationがある
		const options: Options.Publish = {
			priority: event[1],
		};
		if (options.priority !== EVENT_MAX_PRIORITY) {
			options.expiration = "" + EVENT_NON_MAX_PRIORITY_EVENT_TTL;
		}
		const content = encodeEvent(event);
		channel.publish(eventExchangeName, "", content, options);
	}
}
