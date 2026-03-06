import * as amqp from "amqplib";
import { EventEmitter } from "events";
import { AmqpConnectionManager } from "./AmqpConnectionManager";

function wait(ms: number): Promise<void> {
	return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function getWaitMS(retry: number, base: number) {
	return (Math.pow(2, retry - 1) + Math.random()) * base;
}

export type AmqpChannelHolderOptions = {
	maxRetry: number;
	retryBase: number;
};

const defaultOptions: AmqpChannelHolderOptions = {
	maxRetry: 5,
	retryBase: 100,
};

/**
 * エラー時に再接続を行う amqp.Channel のラッパー
 */
export class AmqpChannelHolder extends EventEmitter {
	private isChannelCreated = false;
	private _channel: amqp.Channel | null = null;
	private _createChannelPromise: Promise<amqp.Channel> | null = null;
	private _connectionManager: AmqpConnectionManager;
	private options: AmqpChannelHolderOptions;
	private status: "started" | "stopped" = "stopped";

	constructor(connectionManager: AmqpConnectionManager, options?: Partial<AmqpChannelHolderOptions>) {
		super();
		this._connectionManager = connectionManager;
		this.options = { ...defaultOptions, ...options };
	}

	/**
	 * @deprecated use getChannel
	 */
	get channel(): amqp.Channel | null {
		return this._channel;
	}

	/**
	 * チャンネルを取得する。
	 */
	public async getChannel(): Promise<amqp.Channel> {
		this.status = "started";
		// チャンネル作成済みならそれを返す
		if (this._channel && this.isChannelCreated) {
			return this._channel;
		}
		// チャンネル未作成or作成中なのでcreateChannelを呼ぶ
		return await this.createChannel();
	}

	/**
	 * 接続処理を開始する
	 * @deprecated use getChannel
	 */
	public start(): void {
		this.status = "started";
		this.createChannel().catch(() => undefined); // unhandled rejection防止のためにエラーを握りつぶす
	}

	/**
	 * 接続処理を終了する
	 */
	public async stop(): Promise<void> {
		this.status = "stopped";
		return this.stopInner(false);
	}

	/**
	 * 接続処理の内部用。作成中のPromiseをcreateChannelからの場合は消してしまわないようにしている
	 * @param fromCreateChannel
	 */
	private async stopInner(fromCreateChannel: boolean): Promise<void> {
		if (this._channel) {
			const ch = this._channel;
			this._channel = null;
			if (!fromCreateChannel) {
				this._createChannelPromise = null;
			}
			this.isChannelCreated = false;
			ch.removeAllListeners();
			// close 時のエラーは無視する
			// 現状のバージョンで状況によってはclose()が正しくresolve/rejectされずにいつまでも返ってこないバグがあるので、awaitしない
			await ch.close().catch(() => undefined);
			this.emit("close");
		}
	}

	private async createChannel(): Promise<amqp.Channel> {
		// チャンネル作成中ならそのPromiseを返す
		if (this._createChannelPromise) {
			return this._createChannelPromise;
		}
		const createChannelPromise = this.createChannelInner();
		this._createChannelPromise = createChannelPromise;
		const channel = await createChannelPromise;
		this._createChannelPromise = null;
		return channel;
	}

	private async createChannelInner(): Promise<amqp.Channel> {
		this.stopInner(true);
		let channel!: amqp.Channel;
		for (let retry = 1; retry <= this.options.maxRetry; ++retry) {
			try {
				channel = await this._connectionManager.createChannel();
				break;
			} catch (err) {
				if (retry >= this.options.maxRetry) {
					throw err;
				}
				await wait(getWaitMS(retry, this.options.retryBase));
			}
		}
		// error イベントの後の close はこない
		channel.once("error", (err) => {
			// 利用側にエラーを通知
			this.emit("channel-error", err);
			// ここでそのまま再接続処理をすると、閉じた状態のチャンネルが作られてしまうらしく、setTimeoutで待つ
			setTimeout(() => {
				if (this.status === "stopped") {
					return; // closeしてたら再接続しない
				}
				// エラー時は再接続して、かつunhandled rejection防止のためにcatchする
				// イベント発生時にはthis.channelが新しいのになっている可能性があるので、同じチャンネルかチェックしてから再接続を呼ぶ
				if (this._channel === channel) {
					this.createChannel()
						.then(() => {
							// 利用側に再接続処理を通知
							return this.emit("reconnected", err);
						})
						.catch((e) => this.emit("error", e));
				} else {
					// 利用側に再接続処理を通知
					this.emit("reconnected", err);
				}
			}, 0);
		});
		channel.once("close", () => {
			if (this.status === "stopped") {
				return; // closeしてたら再接続しない
			}
			// 終了時は再接続して、かつunhandled rejection防止のためにcatchする
			// イベント発生時にはthis.channelが新しいのになっている可能性があるので、同じチャンネルかチェックしてから再接続を呼ぶ
			if (this._channel === channel) {
				this.createChannel() // エラーイベント発生時にはthis.channelが新しいのになっている可能性があるので、old
					.catch((err) => this.emit("error", err));
			}
		});
		this._channel = channel;
		this.isChannelCreated = true;
		this.emit("connect");
		return channel;
	}
}
