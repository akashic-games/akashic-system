import amtp = require("@akashic/amtplib");
import events = require("events");
import http from "http";
import ws from "ws";

interface Listeners {
	onClose: () => void;
	onMessage: (data: string | Buffer, isBinary?: boolean) => void;
	onError: (err: any) => void;
	onPong?: () => void;
}

interface Logger {
	warn(message: string): void;
	error(message: string): void;
}

class NullLogger implements Logger {
	warn() {}
	error() {}
}

class ThrottleLogger implements Logger {
	private _baseLogger: Logger;
	private _lastLogErrorAt: number | null = null;
	private _lastLogWarnAt: number | null = null;
	private _logThrottle = 1000;

	set logThrottle(value: number) {
		if (value <= 0) {
			return;
		}
		this._logThrottle = value;
	}

	constructor(baseLogger: Logger) {
		this._baseLogger = baseLogger;
	}

	warn(message: string): void {
		const now = this.getNow().getTime();

		if (this._lastLogWarnAt !== null && this._lastLogWarnAt + this._logThrottle > now) {
			return;
		}

		this._baseLogger.warn(message);
		this._lastLogWarnAt = now;
	}

	error(message: string): void {
		const now = this.getNow().getTime();

		if (this._lastLogErrorAt !== null && this._lastLogErrorAt + this._logThrottle > now) {
			return;
		}

		this._baseLogger.error(message);
		this._lastLogErrorAt = now;
	}

	protected getNow(): Date {
		return new Date();
	}
}

export interface Option {
	reopenTimeout?: number;
	_wsKeepAliveTimeout?: number;
	_wsKeepAliveInterval?: number;
}

export abstract class Socket extends events.EventEmitter implements amtp.Socket {
	constructor() {
		super();
	}

	public abstract send(data: Buffer): void;

	public abstract recv(handler: (data: Buffer) => void): void;

	public abstract attach(rawSocket: any): void;

	public abstract close(): void;

	/**
	 * upgrade した時の HTTP Request Header。
	 */
	public abstract getUpgradeRequest(): http.IncomingMessage;

	/**
	 * @event Socket#close
	 */

	/**
	 * @event Socket#timeout
	 */

	/**
	 * @event Socket#error
	 * @type {Error} err
	 */
}

export const BUFFERED_AMOUNT_ERROR_THRESHOLD = 500000; // 500KB以上溜まってたらエラーを出力する
export const BUFFERED_AMOUNT_WARN_THRESHOLD = 100000; // 100KB以上溜まっていたらwarningを出力する

export class WSSocket extends Socket {
	public readonly upgradeRequest: http.IncomingMessage;

	private _wsSocket: ws;
	private _listeners: Listeners;
	private _recvHandler: (data: Buffer) => void;
	private _reopenTimeout: number;
	private _forcedClose: boolean;
	private _closeTimer: ReturnType<typeof setTimeout>;
	private _open: boolean;
	private _keepAliveTimeout: number;
	private _keepAliveInterval: number;
	private _keepAliveTimeoutTimer: ReturnType<typeof setTimeout>;
	private _keepAliveIntervalTimer: ReturnType<typeof setTimeout>;

	private _logger: Logger = new NullLogger();

	get logger(): Logger {
		return this._logger;
	}

	set logger(logger: Logger) {
		this._logger = new ThrottleLogger(logger);
	}

	constructor(wsSocket: ws, upgradeRequest: http.IncomingMessage, opts?: Option) {
		super();
		this._wsSocket = wsSocket;
		this._recvHandler = null;

		this.upgradeRequest = upgradeRequest;

		opts = opts || {};
		this._reopenTimeout = opts.reopenTimeout == null ? 30 * 1000 : opts.reopenTimeout;
		this._keepAliveInterval = opts._wsKeepAliveInterval == null ? 25 * 1000 : opts._wsKeepAliveInterval;
		this._keepAliveTimeout = opts._wsKeepAliveTimeout == null ? 60 * 1000 : opts._wsKeepAliveTimeout;
		this._forcedClose = false;
		this._open = true;

		this._listeners = {
			onClose: this._onClose.bind(this),
			onError: this._onError.bind(this),
			onMessage: this._onMessage.bind(this),
			onPong: this._onPong.bind(this),
		};
		this._handleWSSocket();
	}

	public send(data: Buffer): void {
		if (this._open && this._wsSocket.readyState === ws.OPEN) {
			const bufferedAmount = this._wsSocket.bufferedAmount;
			if (bufferedAmount > BUFFERED_AMOUNT_ERROR_THRESHOLD) {
				this._logger.error(`送信待ちキューに ${bufferedAmount} バイトのデータが溜まっています`);
			} else if (bufferedAmount > BUFFERED_AMOUNT_WARN_THRESHOLD) {
				this._logger.warn(`送信待ちキューに ${bufferedAmount} バイトのデータが溜まっています`);
			}

			this._wsSocket.send(data, { binary: true });
		}
	}

	public recv(handler: (data: Buffer) => void): void {
		this._recvHandler = handler;
	}

	public attach(socket: ws): void {
		if (this._forcedClose) {
			return;
		}

		this._cleanupWSSocket();

		clearTimeout(this._closeTimer);
		this._wsSocket = socket;

		this._handleWSSocket();
		this._open = true;
		this.emit("attached");
	}

	public close(): void {
		this._forcedClose = true;
		this._stopKeepAlive();
		process.nextTick(() => {
			this._wsSocket.close();
		});
	}

	public ping(): void {
		// see https://github.com/websockets/ws/issues/1515#issuecomment-468753955
		if (!this._open || this._wsSocket.readyState !== ws.OPEN) {
			return;
		}
		try {
			this._wsSocket.ping();
		} catch (err) {
			this.emit("error", err);
		}
	}

	public getUpgradeRequest(): http.IncomingMessage {
		return this.upgradeRequest;
	}

	private _startKeepAlive(): void {
		clearTimeout(this._keepAliveTimeoutTimer);
		this._keepAliveIntervalTimer = setTimeout(() => {
			this.ping();
			this._keepAliveTimeoutTimer = setTimeout(() => {
				this.close();
			}, this._keepAliveTimeout);
		}, this._keepAliveInterval);
	}

	private _stopKeepAlive(): void {
		clearTimeout(this._keepAliveIntervalTimer);
		clearTimeout(this._keepAliveTimeoutTimer);
	}

	private _onPong(): void {
		if (!this._open || this._wsSocket.readyState !== ws.OPEN) {
			return;
		}
		this._startKeepAlive();
	}

	private _onClose(): void {
		this._open = false;
		if (!this._forcedClose) {
			this.emit("disconnected");
			this._stopKeepAlive();
			clearTimeout(this._closeTimer);
			this._closeTimer = setTimeout(() => {
				this.close();
				this._onReopenTimeout();
			}, this._reopenTimeout);
		} else {
			this.emit("close");
		}
	}

	private _handleWSSocket(): void {
		this._wsSocket.on("close", this._listeners.onClose);
		this._wsSocket.on("error", this._listeners.onError);
		this._wsSocket.on("message", this._listeners.onMessage);
		this._wsSocket.on("pong", this._listeners.onPong);
		this._startKeepAlive();
	}

	private _cleanupWSSocket(): void {
		this._wsSocket.removeListener("close", this._listeners.onClose);
		this._wsSocket.removeListener("error", this._listeners.onError);
		this._wsSocket.removeListener("message", this._listeners.onMessage);
		this._wsSocket.removeListener("pong", this._listeners.onPong);
		this._stopKeepAlive();
	}

	private _onReopenTimeout(): void {
		this.emit("timeout");
	}

	private _onError(err: Error): void {
		this.emit("error", err);
	}

	private _onMessage(data: string | Buffer | ArrayBuffer, isBinary: boolean): void {
		if (typeof data === "string" || isBinary === false) {
			this.emit("error", new Error("socket recieved unsupported string type data"));
			this.close();
			return;
		}
		if (data instanceof ArrayBuffer) {
			data = Buffer.from(data as ArrayBuffer);
		}
		if (this._recvHandler) {
			try {
				this._recvHandler(data as Buffer);
			} catch (err) {
				this.emit("error", err);
				this.close();
			}
		}
	}
}
