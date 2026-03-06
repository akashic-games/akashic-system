import { decodeTick, decodeStartPoint } from "@akashic/amflow-message";
import { getQueueNames, tickStoreDeadLetterQueueName, startPointStoreDeadLetterQueueName, playIdHeaderName } from "./constants";
import { TypedEventEmitter } from "../TypedEventEmitter";
import { NullLogger } from "@akashic-system/logger";

import type { Replies, ConsumeMessage } from "amqplib";
import type { AmqpChannelHolder } from "@akashic/amqp-utils";
import type {
	IPlaylogStoreQueue,
	PlaylogQueueCallback,
	TickMessageCallback,
	StartPointMessageCallback,
	DeadLetterQueueCallback,
} from "./IPlaylogQueue";
import { prepareDlx, prepareStoreQueue } from "./prepares";
import type { ILogger } from "@akashic-system/logger";

type ConsumeTags = { readonly tick: string; readonly startPoint: string };

type Subscription = {
	readonly playId: string;
	readonly callbacks: {
		readonly onTickMessage: TickMessageCallback;
		readonly onStartPointMessage: StartPointMessageCallback;
	};
	consumeTags: ConsumeTags;
};
// サブスクリプション生成レシピ = サブスクリプション - AMQPのタグ情報
type SubscriptionRecipe = Omit<Subscription, "consumeTags">;

type DlxSubscription = {
	readonly callbacks: DeadLetterQueueCallback;
	consumeTags: ConsumeTags | null;
};

type AMQPPlaylogStoreQueueEventMap = {
	error: unknown;
};

/**
 * 保存用キューをSubscribeするためのクラス
 * * キューはexchangeを持つPublisherが作る
 * * DeadLetterの取り扱いができる
 */
export class AMQPPlaylogStoreQueue extends TypedEventEmitter<AMQPPlaylogStoreQueueEventMap> implements IPlaylogStoreQueue {
	private readonly channelHolder: AmqpChannelHolder;

	private readonly subscriptionMap = new Map<string, Subscription>();
	private dlxSubscription: DlxSubscription | null = null;

	public logger: ILogger = new NullLogger();

	constructor(channelHolder: AmqpChannelHolder) {
		super();
		this.channelHolder = channelHolder;
	}

	async start(): Promise<void> {
		const channel = await this.channelHolder.getChannel();
		await channel.prefetch(1);
		this.channelHolder.addListener("reconnected", () => {
			Promise.all(
				Array.from(this.subscriptionMap.values()).map(async (subscription) => {
					subscription.consumeTags = await this.subscribeInner(subscription);
				}),
			).catch((err) => this.emit("error", err));
		});
		await prepareDlx(channel);
	}

	async stop(): Promise<void> {
		const channel = await this.channelHolder.getChannel();
		for (const subscription of this.subscriptionMap.values()) {
			await channel.cancel(subscription.consumeTags.tick);
			await channel.cancel(subscription.consumeTags.startPoint);
		}
		this.subscriptionMap.clear();
		if (this.dlxSubscription && this.dlxSubscription.consumeTags) {
			await channel.cancel(this.dlxSubscription.consumeTags.tick);
			await channel.cancel(this.dlxSubscription.consumeTags.startPoint);
			this.dlxSubscription = null;
		}
	}

	async subscribeDeadLetter(callbacks: DeadLetterQueueCallback): Promise<void> {
		const dlxSubscription = {
			callbacks,
			consumeTags: null,
		};
		await this.subscribeDeadLetterInner(dlxSubscription);
		this.dlxSubscription = dlxSubscription;
	}

	private async subscribeDeadLetterInner(dlxSubscription: DlxSubscription): Promise<void> {
		const channel = await this.channelHolder.getChannel();

		const tickResult = await channel.consume(
			tickStoreDeadLetterQueueName,
			(msg) => this.onTickDeadLetter(msg, dlxSubscription.callbacks.onTickMessage),
			{
				noAck: false,
			},
		);
		const startPointResult = await channel.consume(
			startPointStoreDeadLetterQueueName,
			(msg) => this.onStartPointDeadLetter(msg, dlxSubscription.callbacks.onStartPointMessage),
			{
				noAck: false,
			},
		);
		dlxSubscription.consumeTags = {
			tick: tickResult.consumerTag,
			startPoint: startPointResult.consumerTag,
		};
	}

	async subscribe(playId: string, callbacks: PlaylogQueueCallback): Promise<void> {
		if (this.subscriptionMap.has(playId)) {
			return;
		}
		const { onTickMessage, onStartPointMessage } = callbacks;
		if (!onTickMessage || !onStartPointMessage) {
			throw new Error("コールバックに必要な関数がセットされていません");
		}

		const subscription: SubscriptionRecipe = {
			playId,
			callbacks: { onTickMessage, onStartPointMessage },
		};
		const consumeTags = await this.subscribeInner(subscription);
		this.subscriptionMap.set(playId, { ...subscription, consumeTags });
	}

	private async subscribeInner(subscription: SubscriptionRecipe): Promise<ConsumeTags> {
		const channel = await this.channelHolder.getChannel();

		const {
			playId,
			callbacks: { onTickMessage, onStartPointMessage },
		} = subscription;
		let tickResult: Replies.Consume;
		let startPointResult: Replies.Consume;
		try {
			const { tickStoreQueueName, startPointStoreQueueName } = getQueueNames(playId);
			// エラーで落ちないようにキューのassertはやっておく。無駄にキューが作られるが、ドライバの特性的にそちらの方が面倒が無い
			await prepareStoreQueue(channel, playId);
			tickResult = await channel.consume(tickStoreQueueName, (msg) => this.onTickMessage(playId, msg, onTickMessage), { noAck: false });
			startPointResult = await channel.consume(
				startPointStoreQueueName,
				(msg) => this.onStartPointMessage(playId, msg, onStartPointMessage),
				{ noAck: false },
			);
		} catch (err) {
			this.subscriptionMap.delete(playId);
			throw err;
		}

		return {
			tick: tickResult.consumerTag,
			startPoint: startPointResult.consumerTag,
		};
	}

	async unsubscribe(playId: string): Promise<void> {
		const subscription = this.subscriptionMap.get(playId);
		if (!subscription) {
			return;
		}

		const channel = await this.channelHolder.getChannel();

		await channel.cancel(subscription.consumeTags.tick);
		await channel.cancel(subscription.consumeTags.startPoint);
		this.subscriptionMap.delete(playId);
	}

	async hasMessage(playId: string): Promise<boolean | null> {
		const channel = await this.channelHolder.getChannel();

		const { tickStoreQueueName, startPointStoreQueueName } = getQueueNames(playId);
		try {
			const result1 = await channel.checkQueue(tickStoreQueueName);
			const result2 = await channel.checkQueue(startPointStoreQueueName);
			return result1.messageCount > 0 || result2.messageCount > 0;
		} catch {
			return null; // キューが無いと例外が飛ぶため
		}
	}

	async deleteQueue(playId: string): Promise<void> {
		await this.logger.trace(`start AMQPPlaylogStoreQueue#deleteQueue(). playId: ${playId}`);
		const channel = await this.channelHolder.getChannel();

		const { tickStoreQueueName, startPointStoreQueueName } = getQueueNames(playId);
		/**
		 * amqpプロトコルではqueueの存在をエラーを起こさずに安全に存在確認や削除する方法は無い(エラー起こすと購読が切れる)
		 * よって、assertQueueで「なければ作成」することで安全に削除する\
		 */
		const { tickStoreQueue, startPointStoreQueue } = await prepareStoreQueue(channel, playId);
		if (tickStoreQueue.consumerCount === 0) {
			// consumer === 0 ならば安全に削除できる(それ以外で削除すると別のworkerがクラッシュする)
			await channel.deleteQueue(tickStoreQueueName);
			await this.logger.trace(`queue: ${tickStoreQueueName} is deleted`);
		}
		if (startPointStoreQueue.consumerCount === 0) {
			await channel.deleteQueue(startPointStoreQueueName);
			await this.logger.trace(`queue: ${startPointStoreQueueName} is deleted`);
		}
		await this.logger.trace(`finish AMQPPlaylogStoreQueue#deleteQueue(). playId: ${playId}`);
	}

	private async onTickMessage(playId: string, msg: ConsumeMessage | null, callback: TickMessageCallback): Promise<void> {
		if (!msg) {
			return;
		}
		const channel = await this.channelHolder.getChannel();

		const content = msg.content;
		const tick = decodeTick(content);
		try {
			await callback(playId, tick, content);
			channel.ack(msg);
		} catch (err) {
			channel.nack(msg, false, true);
			this.emit("error", err);
		}
	}

	private async onTickDeadLetter(msg: ConsumeMessage | null, callback: TickMessageCallback): Promise<void> {
		if (!msg) {
			return;
		}
		const channel = await this.channelHolder.getChannel();

		const playId = msg.properties.headers?.[playIdHeaderName];
		if (!playId) {
			// ヘッダが無い？？？？？
			await this.logger.warn("playIdヘッダがセットされていないメッセージがtick用dead letterに来た");
			// メッセージ残ってても仕方ないので処分
			channel.ack(msg);
			return;
		}
		await this.onTickMessage(playId, msg, callback);
	}

	private async onStartPointMessage(playId: string, msg: ConsumeMessage | null, callback: StartPointMessageCallback): Promise<void> {
		if (!msg) {
			return;
		}
		const channel = await this.channelHolder.getChannel();

		const content = msg.content;
		const startPoint = decodeStartPoint(content);
		try {
			await callback(playId, startPoint, content);
			channel.ack(msg);
		} catch (err) {
			channel.nack(msg, false, true);
			this.emit("error", err);
		}
	}

	private async onStartPointDeadLetter(msg: ConsumeMessage | null, callback: StartPointMessageCallback): Promise<void> {
		if (!msg) {
			return;
		}
		const channel = await this.channelHolder.getChannel();

		const playId = msg.properties.headers?.[playIdHeaderName];
		if (!playId) {
			// ヘッダが無い？？？？？
			await this.logger.warn("playIdヘッダがセットされていないメッセージがtick用dead letterに来た");
			// メッセージ残ってても仕方ないので処分
			channel.ack(msg);
			return;
		}
		await this.onStartPointMessage(playId, msg, callback);
	}
}
