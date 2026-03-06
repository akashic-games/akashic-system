import * as amqp from "amqplib";
import { EventEmitter } from "events";
import * as URL from "url";

/**
 * amqplib.Connection のラッパー
 *
 * 切断時に再接続を行う
 * 接続時に "connect" イベントを emit する
 * 切断時に "disconnect" イベントを emit する
 */
export class AmqpConnection extends EventEmitter {
	private _url: URL.UrlObject;
	private _options: any;
	private _connection: amqp.ChannelModel | null;
	private _running: boolean;

	constructor(url: string, user?: string, password?: string, options?: any) {
		super();
		this._connection = null;
		this._url = URL.parse(url);
		this._url.port = this._url.port || 5672; // default port
		this._url.pathname = this._url.pathname || "/"; // default vhost
		if (user && password) {
			this._url.auth = [user, password].join(":");
		}
		this._options = options;
		this._running = false;
	}

	get url(): string {
		// 認証情報を含めない形で返す
		return `${this._url.protocol}//${this._url.hostname}:${this._url.port}${this._url.pathname}`;
	}

	get connection(): amqp.ChannelModel | null {
		return this._connection;
	}

	public async connect(): Promise<void> {
		this._running = true;
		return this._reconnect(0);
	}

	public async close(): Promise<void> {
		// 再接続を抑止
		this._running = false;
		if (this._connection) {
			// close 時のエラーは無視
			await this._connection.close().catch(() => undefined);
			this._connection.removeAllListeners();
			this._connection = null;
			this.emit("close");
		}
	}

	private async _connect(): Promise<void> {
		this._connection = await amqp.connect(URL.format(this._url), this._options);
		// error イベントの後の close はこない
		this._connection.once("error", () => {
			this._reconnect(0);
		});
		this._connection.once("close", () => {
			this._reconnect(0);
		});
	}

	private async _reconnect(retry: number): Promise<void> {
		if (!this._running) {
			return;
		}
		if (this._connection) {
			const connection = this._connection;
			this._connection = null;
			try {
				await connection.close().catch(() => undefined);
			} catch (err) {
				// close 時のエラーは無視
			}
			this.emit("close");
		}
		try {
			await this._connect();
			this.emit("connect");
		} catch (err) {
			// リトライ 10 回目までは 1 秒おき、以降は 10 秒ごとに再接続を試みる
			let sleep: number = 1000;
			if (retry > 10) {
				sleep = 10000;
			}
			await new Promise((resolve) => {
				setTimeout(resolve, sleep);
			});
			return this._reconnect(retry + 1);
		}
	}
}
