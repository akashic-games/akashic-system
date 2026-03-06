import * as amtp from "@akashic/amtplib";
import * as events from "events";
import * as querystring from "querystring";

export enum Type {
	WebSocket = 1,
}

export interface Option {
	query?: any;
	// 接続のタイムアウト時間
	connectTimeout?: number;
	// 再接続のリトライ間隔
	reconnectInterval?: number;
	// 再接続の最大リトライ数
	reconnectMaxRetry?: number;
}

export enum ReadyState {
	Close,
	Closing,
	Open,
	Opening,
	Reopening,
}

/**
 * イベント
 * - open - 接続完了時。
 * - close - 切断時。再接続処理に入る場合はemitされない。再接続の失敗した場合もemitされる。
 * - reopening - 再接続開始時。再接続完了後にopenをemitする。
 * - error - エラー発生時。
 */
export abstract class Socket extends events.EventEmitter implements amtp.Socket {
	public forcedClose: boolean;
	protected readyState: ReadyState;

	protected _url: string;
	protected _opts: Option;
	protected _recvHandler: (data: Buffer) => void;

	protected _connectTimeout: number;
	protected _connectTimeoutTimer: ReturnType<typeof setTimeout>;
	protected _reconnectTimer: ReturnType<typeof setTimeout>;
	protected _reconnectDelay: number;
	protected _reconnectMaxRetry: number;
	protected _reconnectRetry: number;

	constructor(url: string, opts?: Option) {
		super();
		this.readyState = ReadyState.Close;
		this.forcedClose = false;

		opts = opts || {};
		opts.query = opts.query || {};
		this._opts = opts;
		this._recvHandler = null;
		this._connectTimeout = this._opts.connectTimeout || 30 * 1000;
		this._reconnectDelay = this._opts.reconnectInterval || 1000;
		this._reconnectMaxRetry = this._opts.reconnectMaxRetry || 3;
		this._reconnectRetry = 0;

		this._reconnectTimer = null;
		this._connectTimeoutTimer = null;

		this._url = url;
	}
	public abstract send(data: Buffer): void;
	public abstract open(): void;
	public abstract close(): void;
	public recv(handler: (data: Buffer) => void): void {
		if (this._recvHandler) {
			throw new Error("The receive handler of socket is already attached.");
		}
		this._recvHandler = handler;
	}

	public setUID(uid: string): void {
		this._opts.query.uid = uid;
	}
}

interface WSListeners {
	onOpen(ev: Event): void;
	onClose(ev: CloseEvent): void;
	onMessage(ev: MessageEvent): void;
	onError(ev: Event): void;
}

export class WSSocket extends Socket {
	private _listeners: WSListeners;
	private _socket: WebSocket;

	constructor(url: string, opts?: Option) {
		super(url, opts);
		this._listeners = {
			onOpen: (_: Event): void => {
				this._onOpen();
			},
			onClose: (_: CloseEvent): void => {
				this._onClose();
			},
			onError: (ev: ErrorEvent): void => {
				this._onError(ev);
			},
			onMessage: (ev: MessageEvent): void => {
				this._onMessage(ev.data);
			},
		};
		this._socket = null;
	}
	public open(): void {
		this.readyState = ReadyState.Opening;
		this._open();
	}
	public close(): void {
		this.forcedClose = true;
		this._close();
	}
	public send(data: Buffer): void {
		if (this.readyState !== ReadyState.Open) {
			return;
		}
		const d = global.Buffer ? data : toArrayBuffer(data);
		this._socket.send(d);
	}
	private _open(): void {
		this._socket = new WebSocket(this._url + "?" + querystring.stringify(this._opts.query));
		this._socket.binaryType = "arraybuffer";
		this._socket.addEventListener("open", this._listeners.onOpen);
		this._socket.addEventListener("close", this._listeners.onClose);
		this._socket.addEventListener("message", this._listeners.onMessage);
		this._socket.addEventListener("error", this._listeners.onError);
		this._connectTimeoutTimer = setTimeout(() => {
			this.close();
			this.emit("error", new Error("connection timeout"));
		}, this._connectTimeout);
	}
	private _close(): void {
		if (this.readyState === ReadyState.Closing || this.readyState === ReadyState.Close) {
			return;
		}
		const beforeState = this.readyState;
		this.readyState = ReadyState.Closing;
		clearTimeout(this._reconnectTimer);
		clearTimeout(this._connectTimeoutTimer);
		if (beforeState === ReadyState.Reopening && this._socket.readyState === WebSocket.CLOSED) {
			this.emit("close");
			this._cleanupListeners();
		} else {
			this._socket.close();
		}
	}
	private _onOpen(): void {
		clearTimeout(this._connectTimeoutTimer);
		this.readyState = ReadyState.Open;
		this._reconnectRetry = 0;
		this.emit("open");
	}
	private _onClose(): void {
		clearTimeout(this._connectTimeoutTimer);
		let err: Error = null;
		if (!this.forcedClose && (this.readyState === ReadyState.Open || this.readyState === ReadyState.Reopening)) {
			if (this._reconnectRetry < this._reconnectMaxRetry) {
				this._cleanupListeners();
				this._reopen();
				return;
			} else {
				err = new Error("failed to reconnect");
			}
		}
		this.readyState = ReadyState.Close;
		this.emit("close");
		this._cleanupListeners();
		if (err) {
			this.emit("error", err);
		}
	}
	private _onError(ev: Event): void {
		if (this.readyState === ReadyState.Opening || this.readyState === ReadyState.Reopening) {
			this._onClose();
			return;
		}
		const err = new Error("WebSocket error");
		(err as any).cause = ev;
		this.emit("error", err);
	}
	private _reopen(): void {
		this.readyState = ReadyState.Reopening;
		let immediately = false;
		if (this._reconnectRetry === 0) {
			this.emit("reopening");
			immediately = true;
		}
		this._reconnectRetry++;
		this._reconnectTimer = setTimeout(
			() => {
				this._open();
			},
			immediately ? 0 : this._reconnectDelay,
		);
	}
	private _onMessage(data: Buffer | ArrayBuffer | string): void {
		if (typeof data === "string") {
			throw new Error("socket received string data");
		}
		if (data instanceof ArrayBuffer) {
			data = Buffer.from(new Uint8Array(data as ArrayBuffer));
		}
		if (this._recvHandler) {
			this._recvHandler(data as Buffer);
		}
	}
	private _cleanupListeners(): void {
		this._socket.removeEventListener("open", this._listeners.onOpen);
		this._socket.removeEventListener("close", this._listeners.onClose);
		this._socket.removeEventListener("message", this._listeners.onMessage);
		this._socket.removeEventListener("error", this._listeners.onError);
	}
}

function toArrayBuffer(buf: Buffer): ArrayBuffer {
	const len = buf.length;
	const arr = new ArrayBuffer(len);
	const view = new Uint8Array(arr);
	for (let i = 0; i < len; i++) {
		view[i] = buf[i];
	}
	return arr;
}
