import deepEqual from "fast-deep-equal";
import { EventFlagsMask, EventIndex, TickIndex } from "@akashic/playlog";
import { PlaylogStoreStartPointConflictError, PlaylogStoreTickConflictError } from "./PlaylogStore";
import { TypedEventEmitter } from "./TypedEventEmitter";
import { ILogger, NullLogger, LoggerAware } from "@akashic-system/logger";

import type { Tick } from "@akashic/playlog";
import type { StartPoint } from "@akashic/amflow";
import type { IPlaylogQueueStatusDatabase } from "./IPlaylogQueueStatusDatabase";
import type { IPlaylogStore } from "./PlaylogStore";
import type { IPlaylogStoreQueue } from "./PlaylogQueue";
import type { IPlayDatabase } from "./plays";

const updateInterval = 1000; // 1秒
const expireTime = 10 * 60 * 1000; // 10分
const DELAY_ERROR_SEC = 10;
const DELAY_WARN_SEC = 6;

type Subscription = {
	playId: string;
	changeClosingAt: number | null;
};

type ConflictedTick = {
	playId: string;
	storedTick: Tick | null;
	receivedTick: Tick;
};

type ConflictedStartPoint = {
	playId: string;
	storedStartPoint: StartPoint | null;
	receivedStartPoint: StartPoint;
};

type PlaylogQueueConsumerEventMap = {
	error: unknown;
	tickConflicted: ConflictedTick;
	startPointConflicted: ConflictedStartPoint;
};

function removeTargetEvents(tick: Tick, targetEventFlags: number[]): Tick {
	const events = tick[TickIndex.Events];
	// イベントが無ければ処理しない
	if (!Array.isArray(events)) {
		return tick;
	}
	const filterdEvents = events.filter((event) =>
		targetEventFlags.every((targetEventFlag) => !(event[EventIndex.EventFlags] & targetEventFlag)),
	);
	const replacedTick: Tick = [...tick] as Tick;
	replacedTick[TickIndex.Events] = filterdEvents;
	return replacedTick;
}

export class PlaylogQueueConsumer extends TypedEventEmitter<PlaylogQueueConsumerEventMap> implements LoggerAware {
	private stopped = false;
	private timerHandler: NodeJS.Timeout | null = null;
	private readonly subscriptions = new Map<string, Subscription>();

	private readonly store: IPlaylogStore;
	private readonly queue: IPlaylogStoreQueue;
	private readonly statusDatabase: IPlaylogQueueStatusDatabase;
	private readonly playDatabase: IPlayDatabase;

	public logger: ILogger = new NullLogger();

	constructor(store: IPlaylogStore, queue: IPlaylogStoreQueue, statusDatabase: IPlaylogQueueStatusDatabase, playDatabase: IPlayDatabase) {
		super();
		this.store = store;
		this.queue = queue;
		this.statusDatabase = statusDatabase;
		this.playDatabase = playDatabase;
	}

	async start(): Promise<void> {
		await this.queue.start();
		await this.queue.subscribeDeadLetter({
			onTickMessage: (playId, tick) => this.storeTick(playId, tick),
			onStartPointMessage: (playId, startPoint) => this.storeStartPoint(playId, startPoint),
		});

		const func = async () => {
			try {
				await this.onUpdate();
			} catch (e) {
				this.emit("error", e);
			}
			if (this.stopped) {
				return;
			}
			this.timerHandler = setTimeout(func, updateInterval);
		};
		await func();
	}

	async stop(): Promise<void> {
		await this.queue.stop();
		this.stopped = true;
		if (this.timerHandler) {
			clearInterval(this.timerHandler);
		}
	}

	/**
	 * プレイログ状態テーブルを定期監視し、状態変化したものについて処理をする。
	 * * プレイ中になったプレイについてはsubscribeする
	 * * プレイ中で無くなったプレイについてはunsubscribeする
	 */
	protected async onUpdate(): Promise<void> {
		// プレイ中のプレイのID一覧を取得
		const runningPlays = await this.statusDatabase.getWritingPlays();
		// 現在サブスクライブ中のID一覧から削除対象を抽出するためのSetを作成
		const deletingIds = new Set(this.subscriptions.keys());

		// 新規プレイと終了プレイを処理
		// 稼働中のプレイのうち、未subscribeの物をsubscribe
		for (const runningPlay of runningPlays) {
			const subscription = await this.assertSubscription(runningPlay.playId);
			deletingIds.delete(runningPlay.playId);

			if (runningPlay.writeStatus === "closing" && subscription.changeClosingAt === null) {
				subscription.changeClosingAt = this.getNow().getTime();
			}
		}

		// subscriptionのうち、closingになって時間が経ち、かつ最後のeventが来たのがだいぶ前の場合は削除対象に入れる
		const now = this.getNow().getTime();
		for (const subscription of this.subscriptions.values()) {
			if (subscription.changeClosingAt !== null && subscription.changeClosingAt + expireTime < now) {
				deletingIds.add(subscription.playId);
			}
		}

		// 削除対象のキューの処理をする
		for (const deletingId of deletingIds) {
			await this.unsubscribeAndDelete(deletingId);
		}
	}

	/**
	 * tick/startPointをsubscribeする。subscribe済みだったら何もしない
	 * (assert=rabbitmqのassertと同じ意味)
	 */
	private async assertSubscription(playId: string): Promise<Subscription> {
		const subscription = this.subscriptions.get(playId);
		if (subscription) {
			return subscription;
		}

		await this.logger.info(`新規プレイのキューを購読. playId: ${playId}`);

		// キューをsubscribeしてないのでsubscribeする
		await this.queue.subscribe(playId, {
			onTickMessage: (id, tick) => this.storeTick(id, tick),
			onStartPointMessage: (id, startPoint) => this.storeStartPoint(id, startPoint),
		});

		const newSubscription = {
			playId,
			changeClosingAt: null,
		};
		this.subscriptions.set(playId, newSubscription);
		await this.logger.info(`新規プレイのキューの購読完了. playId: ${playId}`);
		return newSubscription;
	}

	private async storeTick(playId: string, tick: Tick): Promise<void> {
		if (tick[TickIndex.Frame] === 1) {
			await this.logger.trace(`frame===1のtickをストア. playId: ${playId}`);
			const delayed = await this.getSecFromPlayStartedSec(playId);
			if (delayed >= DELAY_ERROR_SEC) {
				await this.logger.error(`tickが ${delayed} 秒遅延しています。 playId: ${playId}`);
			} else if (delayed >= DELAY_WARN_SEC) {
				await this.logger.warn(`tickが ${delayed} 秒遅延しています。 playId: ${playId}`);
			}
		}

		// 通常保存するtickはtransientイベントのみを除去する
		const storeTick = removeTargetEvents(tick, [EventFlagsMask.Transient]);
		// ignorableとして保存するtickはtransientとignorableイベントの両方を除外する
		const excludedIgnorableTick = removeTargetEvents(tick, [EventFlagsMask.Transient, EventFlagsMask.Ignorable]);

		// 保存
		await this.storeTickInner(playId, storeTick, false);
		await this.storeTickInner(playId, excludedIgnorableTick, true);
	}

	private async storeTickInner(playId: string, tickToStore: Tick, excludedIgnorable: boolean) {
		try {
			await this.store.putTick(playId, tickToStore, { ignorable: excludedIgnorable });
		} catch (err) {
			if (!(err instanceof PlaylogStoreTickConflictError)) {
				// tick衝突以外はerrorイベント発火
				this.emit("error", err);
			} else {
				// Tick衝突時のリカバリ処理
				const { receivedTick } = err;
				const storedTick = await this.store.getTick(playId, tickToStore[TickIndex.Frame], err.excludeEventFlags);
				// 衝突してたらエラーとして処理。そうでないならログだけ吐く
				if (!deepEqual(storedTick, receivedTick)) {
					this.emit("tickConflicted", { playId, storedTick, receivedTick });
				} else {
					await this.logger.warn(
						`tickが重複していましたが、すでに保存されているデータと同じでした。 playId: ${playId} frame: ${
							tickToStore[TickIndex.Frame]
						} ignorable: ${err.excludeEventFlags?.ignorable}`,
					);
				}
			}
		}
	}

	private async storeStartPoint(playId: string, startPoint: StartPoint): Promise<void> {
		await this.logger.trace(`startpointをストア. playId: ${playId}`);
		if (startPoint.frame === 1) {
			const delayed = await this.getSecFromPlayStartedSec(playId);
			if (delayed >= DELAY_ERROR_SEC) {
				await this.logger.error(`startPointが ${delayed} 秒遅延しています。 playId: ${playId}`);
			} else if (delayed >= DELAY_WARN_SEC) {
				await this.logger.warn(`startPointが ${delayed} 秒遅延しています。 playId: ${playId}`);
			}
		}
		try {
			await this.store.putStartPoint(playId, startPoint);
		} catch (err) {
			if (!(err instanceof PlaylogStoreStartPointConflictError)) {
				this.emit("error", err);
			} else {
				// Tick衝突時のリカバリ処理
				const { receivedStartPoint } = err;
				const storedStartPoint = await this.store.getStartPoint(playId, startPoint.frame);
				// 衝突してたらエラーとして処理。そうでないならログだけ吐く
				if (!deepEqual(storedStartPoint, receivedStartPoint)) {
					this.emit("startPointConflicted", { playId, storedStartPoint, receivedStartPoint });
				} else {
					await this.logger.warn(
						`startPointが重複していましたが、すでに保存されているデータと同じでした。 playId: ${playId} frame: ${startPoint.frame}`,
					);
				}
			}
		}
	}

	private async unsubscribeAndDelete(playId: string): Promise<void> {
		await this.logger.info(`購読終了処理開始. playId: ${playId}`);
		const hasMessage = await this.queue.hasMessage(playId);
		if (hasMessage) {
			await this.logger.warn(`メッセージが残っているので終了処理をスキップしました. playId: ${playId}`);
			return; // メッセージが残っているなら何もしない
		}
		await this.queue.unsubscribe(playId);
		await this.queue.deleteQueue(playId);
		this.subscriptions.delete(playId);
		await this.statusDatabase.setClosed(playId);
		await this.logger.info(`購読終了処理完了. playId: ${playId}`);
	}
	private async getSecFromPlayStartedSec(playId: string): Promise<number> {
		const started = await this.playDatabase.getStarted(playId);
		if (started === null) {
			await this.logger.warn(`playId: ${playId} に対応するレコードがplaysにありません`);
			return 0; // いったん遅延無し扱いにする
		}
		return (this.getNow().getTime() - started.getTime()) / 1000;
	}

	/**
	 * テスト時に getNow() を上書きしてコントロールできるようにしてある
	 */
	protected getNow(): Date {
		return new Date();
	}
}
