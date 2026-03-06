import { decodeTick, decodeEvent } from "@akashic/amflow-message";
import { getExchangeNames, getQueueNames } from "./constants";
import { TypedEventEmitter } from "../TypedEventEmitter";

import type { Channel, ConsumeMessage } from "amqplib";
import type { AmqpChannelHolder } from "@akashic/amqp-utils";
import type { IPlaylogQueue, PlaylogQueueCallback, TickMessageCallback, EventMessageCallback } from "./IPlaylogQueue";

type Subscription = {
	readonly playId: string;
	readonly callbacks: PlaylogQueueCallback;
	tickConsumeTag: string | null;
	eventConsumeTag: string | null;
};

type AMQPPlaylogQueueEventMap = {
	error: unknown;
};

/**
 * 随時購読用のキューを作ってexchangeに繋ぐタイプのQueue
 * * 購読する前のtickは取れない。なぜならば、キューを新しく自分で作るから
 * * DeadLetterの取り扱いは出来ない。
 */
export class AMQPPlaylogQueue extends TypedEventEmitter<AMQPPlaylogQueueEventMap> implements IPlaylogQueue {
	private readonly channelHolder: AmqpChannelHolder;
	protected readonly subscriptionMap = new Map<string, Subscription>();

	private readonly handleReconnect = () => {
		Promise.all(
			Array.from(this.subscriptionMap.values()).map(async (subscription) => {
				try {
					await this.subscribeInner(subscription);
				} catch (error) {
					const err = error as { code: number };
					if (err?.code === 404) {
						// 再講読でexchangeが無かった場合は購読リストから削除
						this.subscriptionMap.delete(subscription.playId);
					}

					this.emit("error", err);
				}
			}),
		);
	};

	constructor(channelHolder: AmqpChannelHolder) {
		super();
		this.channelHolder = channelHolder;
	}

	async start() {
		this.channelHolder.addListener("reconnected", this.handleReconnect);
	}

	async stop(): Promise<void> {
		this.channelHolder.removeListener("reconnected", this.handleReconnect);
		const channel = await this.channelHolder.getChannel();
		for (const subscription of this.subscriptionMap.values()) {
			if (subscription.tickConsumeTag !== null) {
				await channel.cancel(subscription.tickConsumeTag);
			}
			if (subscription.eventConsumeTag !== null) {
				await channel.cancel(subscription.eventConsumeTag);
			}
		}
		this.subscriptionMap.clear();
	}

	async subscribe(playId: string, callbacks: PlaylogQueueCallback): Promise<void> {
		if (this.subscriptionMap.has(playId)) {
			return;
		}
		const subscription: Subscription = {
			playId,
			callbacks,
			tickConsumeTag: null,
			eventConsumeTag: null,
		};
		await this.subscribeInner(subscription);
		this.subscriptionMap.set(playId, subscription);
	}

	private async subscribeInner(subscription: Subscription): Promise<void> {
		const channel = await this.channelHolder.getChannel();
		const playId = subscription.playId;
		const { onTickMessage, onEventMessage } = subscription.callbacks;
		try {
			if (onTickMessage) {
				subscription.tickConsumeTag = await this.subscribeTick(channel, playId, onTickMessage);
			}
			if (onEventMessage) {
				subscription.eventConsumeTag = await this.subscribeEvent(channel, playId, onEventMessage);
			}
		} catch (err) {
			// tickの購読のcancelは行わない(amqpの仕様上、例外飛んだらチャンネル閉じられて購読が死ぬから)
			throw err;
		}
	}

	async unsubscribe(playId: string): Promise<void> {
		const subscription = this.subscriptionMap.get(playId);
		if (!subscription) {
			return;
		}

		const channel = await this.channelHolder.getChannel();

		if (subscription.tickConsumeTag !== null) {
			await channel.cancel(subscription.tickConsumeTag);
		}
		if (subscription.eventConsumeTag !== null) {
			await channel.cancel(subscription.eventConsumeTag);
		}
		this.subscriptionMap.delete(playId);
	}

	private async subscribeTick(channel: Channel, playId: string, onTickMessage: TickMessageCallback): Promise<string> {
		const assertQueueOptions = {
			exclusive: true,
			autoDelete: true,
		};
		const { queue } = await channel.assertQueue("", assertQueueOptions);

		const consumeOptions = {
			noAck: true,
			exclusive: true,
		};
		const consumeResult = await channel.consume(
			queue,
			(msg) => {
				if (!msg) {
					// 突然キャンセルされたケースでは仕様上はnullが来るらしい(実際にnullが来ることはドライバの実装上無さそう)。
					return;
				}
				const tick = decodeTick(msg.content);
				onTickMessage(playId, tick, msg.content);
			},
			consumeOptions,
		);

		const { tickBroadcastExchangeName } = getExchangeNames(playId);
		await channel.bindQueue(queue, tickBroadcastExchangeName, "");

		return consumeResult.consumerTag;
	}

	private async subscribeEvent(channel: Channel, playId: string, onEventMessage: EventMessageCallback): Promise<string> {
		const { eventQueueName } = getQueueNames(playId);
		// eventについてはプレイ作成時にキューとexchangeを作成するので、ここでは作らずにそのままsubscribeする
		const consumeResult = await channel.consume(eventQueueName, (msg) => this.onEventMessage(playId, msg, onEventMessage), {
			noAck: false,
		});
		return consumeResult.consumerTag;
	}

	private async onEventMessage(playId: string, msg: ConsumeMessage | null, callback: EventMessageCallback): Promise<void> {
		if (!msg) {
			// 突然キャンセルされたケースでは仕様上はnullが来るらしい(実際にnullが来ることはドライバの実装上無さそう)。
			return;
		}
		const channel = await this.channelHolder.getChannel();

		const content = msg.content;
		const event = decodeEvent(content);
		try {
			await callback(playId, event, content);
			channel.ack(msg);
		} catch (err) {
			channel.nack(msg, false, true);
			this.emit("error", err);
		}
	}
}
