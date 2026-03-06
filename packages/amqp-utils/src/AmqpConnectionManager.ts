import * as amqp from "amqplib";
import { EventEmitter } from "events";
import { AmqpConnection } from "./AmqpConnection";
import { AmqpNotFoundError } from "./errors";

export interface Config {
	urls: string | string[];
	user?: string;
	password?: string;
	options?: any;
}

export class AmqpConnectionManager extends EventEmitter {
	public static DEFAULT_RETRY: number = 3;
	private _config: Config;
	private _currentConnIndex: number;
	private _connections: AmqpConnection[];

	constructor(config: Config) {
		super();
		this._config = config;
		this._currentConnIndex = 0;
		this._connections = [];
	}

	/**
	 * コンストラクタの config 引数で指定されたサーバに接続する。
	 * 1 つでもコネクションが利用可能になったところで resolve する。
	 */
	public init(timeout: number = 5000): Promise<void> {
		let urls: string[];
		if (Array.isArray(this._config.urls)) {
			urls = this._config.urls as string[];
		} else {
			urls = [this._config.urls as string];
		}
		const tasks: Promise<void>[] = [];
		urls.forEach((url, index) => {
			const connection = new AmqpConnection(url, this._config.user, this._config.password, this._config.options);
			connection.on("connect", () => {
				this.emit("connect", connection);
			});
			connection.on("close", () => {
				this.emit("close", connection);
			});
			this._connections[index] = connection;
			tasks.push(connection.connect());
		});
		if (timeout >= 0) {
			tasks.push(
				new Promise<void>((_, reject) =>
					setTimeout(() => {
						reject(new Error("connect to amqp servers timeout"));
					}, timeout),
				),
			);
		}
		return Promise.race(tasks);
	}

	/**
	 * 全てのサーバから切断する
	 */
	public async close(): Promise<void> {
		this._connections.forEach(async (connection) => {
			await connection.close();
		});
		this._connections = [];
	}

	/**
	 * 利用可能な接続をラウンドロビンで一つ取得する
	 */
	public getConnection(): amqp.ChannelModel {
		let result: amqp.ChannelModel | null;
		const len = this._connections.length;
		for (let i = 0; i < len; ++i) {
			result = this._connections[this._currentConnIndex].connection;
			this._currentConnIndex = (this._currentConnIndex + 1) % len;
			if (result) {
				return result;
			}
		}
		throw new Error("no amqp connection available");
	}

	/**
	 * 利用可能な接続から channel を生成して返す。
	 *
	 */
	public async createChannel(): Promise<amqp.Channel> {
		const conn = this.getConnection();
		return await conn.createChannel();
	}

	/**
	 * 利用可能な接続から confirm channel を生成して返す。
	 */
	public async createConfirmChannel(): Promise<amqp.ConfirmChannel> {
		const conn = this.getConnection();
		return await conn.createConfirmChannel();
	}

	/**
	 * 利用可能な接続から channel を生成し、生成した channel を引数にして task を実行する
	 *
	 * @param task 実行するタスク
	 * @param retry リトライ回数
	 */
	public async doChannelTask<T>(task: (ch: amqp.Channel) => Promise<T>, retry?: number): Promise<T> {
		return this._doChannelTask<T>(task, () => this.createChannel(), retry);
	}

	/**
	 * 利用可能な接続から confirm channel を生成し、生成した channel を引数にして task を実行する
	 *
	 * @param task 実行するタスク
	 * @param retry リトライ回数
	 */
	public async doConfirmChannelTask<T>(task: (ch: amqp.ConfirmChannel) => Promise<T>, retry?: number): Promise<T> {
		return this._doChannelTask<T>(
			task as any /* 第2引数の関数の戻り値が ConfirmChannel なので型的にはセーフだけれど、ちゃんとかくのめんどい */,
			() => this.createConfirmChannel(),
			retry,
		);
	}

	/**
	 * 利用可能な接続を使って Buffer を publish する
	 *
	 * @param exchange 送信先 exchange
	 * @param routingKey ルーティングキー
	 * @param data publish データ
	 * @param options publish オプション
	 */
	public async publish(exchange: string, routingKey: string, data: Buffer, options?: amqp.Options.Publish): Promise<void> {
		return this.doConfirmChannelTask<void>((ch) => this._publish(ch, exchange, routingKey, data, options));
	}

	/**
	 * 利用可能な接続を使って任意のオブジェクトを JSON string にして publish する
	 *
	 * @param exchange 送信先 exchange
	 * @param routingKey ルーティングキー
	 * @param data publish データ
	 * @param options publish オプション
	 */
	public async publishObject(exchange: string, routingKey: string, data: any, options?: amqp.Options.Publish): Promise<void> {
		const raw = Buffer.from(JSON.stringify(data));
		return this.doConfirmChannelTask<void>((ch) => this._publish(ch, exchange, routingKey, raw, options));
	}

	private async _doChannelTask<T>(
		task: (channel: amqp.Channel) => Promise<T>,
		createChannelFn: () => Promise<amqp.Channel>,
		retry: number = AmqpConnectionManager.DEFAULT_RETRY,
	): Promise<T> {
		let count: number = 0;
		const retryMax = retry >= 0 ? retry : AmqpConnectionManager.DEFAULT_RETRY;
		while (true) {
			let ch: amqp.Channel | null = null;
			try {
				ch = await createChannelFn();
				// channel のエラーハンドラを登録しないと、channel error 発生時に
				// connection 側のエラーハンドラが呼ばれ、無駄な再接続が発生してしまう
				ch.on("error", (err) => {
					this.emit("channelError", err);
				});
				const result = await task(ch);
				return result;
			} catch (err) {
				// code 404 エラーはリトライしない
				if (err instanceof AmqpNotFoundError) {
					throw err;
				}
				++count;
				if (count > retryMax) {
					throw err;
				}
			} finally {
				if (ch) {
					// close 時のエラーは無視する
					await ch.close().catch(() => undefined);
				}
			}
		}
	}

	private async _publish(
		ch: amqp.ConfirmChannel,
		exchange: string,
		routingKey: string,
		data: Buffer,
		options?: amqp.Options.Publish,
	): Promise<void> {
		try {
			await ch.checkExchange(exchange);
		} catch (error) {
			const err = error as Error;
			if (err && err.message && err.message.indexOf("404 (NOT-FOUND)") >= 0) {
				throw new AmqpNotFoundError(`exchange ${exchange} not found`, err);
			}
			throw err;
		}
		return new Promise<void>((resolve, reject) => {
			ch.publish(exchange, routingKey, data, options, (err) => {
				if (err) {
					return reject(err);
				}
				resolve();
			});
		});
	}
}
