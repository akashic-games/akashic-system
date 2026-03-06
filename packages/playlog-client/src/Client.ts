import * as amflow from "@akashic/amflow";
import * as amtp from "@akashic/amtplib";
import * as playlog from "@akashic/playlog";

import * as amflowMessage from "@akashic/amflow-message";
import Request = amflowMessage.Request;
import Response = amflowMessage.Response;

import { BufferedPipe } from "./BufferedPipe";
import * as errors from "./errors";
import { AssignedPushPipes, PushPipeHandler, PushPipes } from "./PushPipeHandler";

enum ReadyState {
	Closed,
	Closing,
	Opening,
	Open,
}

export interface Option {
	// AMTP Channelをprimaryとするか否か。省略時はtrue。
	usePrimaryChannel?: boolean;
	requestTimeout?: number; // TODO: 未使用
}

export type getTickListCallback = (error: Error | null, tickList?: playlog.TickList) => void;

/**
 * `Client` は 1 プレイ毎に生成される AMFlow 実装です。全ての `Client` は `Session#createClient` で生成する必要があります。
 * 各 AMFlow メソッド呼び出し時に playlog-server とどのような通信が行われるか述べます。
 *
 * WebSocket のコネクションが `close()` の呼び出し以外で切断された場合、再接続を試みます。
 * この際、 `open()` 時に指定した UUID を用いて再接続を行うことで、playlog-server は同一クライアントからの接続だと判断します。
 *
 */
export class Client implements amflow.AMFlow {
	private _readyState: ReadyState;
	private _opts: Option;

	private _amtpClient: amtp.Client;
	private _amtpChannel: amtp.Channel;

	// request pipes
	private _requestPipe: amtp.RequestPipe;
	private _serverRequestPipe: amtp.IncomingRequestPipe;

	// push pipes
	private _pushPipes: PushPipes;
	private _assignedPushPipes: AssignedPushPipes;
	private _pushPipeHandler: PushPipeHandler;

	private _permission: amflow.Permission;
	private _tickHandlers: ((tick: playlog.Tick) => void)[];
	private _eventHandlers: ((event: playlog.Event) => void)[];

	private _eventBuffer: playlog.Event[]; // TODO: 暫定。本来はplaylog-clientでバッファせずに、playlog-serverにStartConsumeEventRequestみたいなのを送るべき。
	private _bp: BufferedPipe;

	constructor(amtpClient: amtp.Client, bufferedPipe: BufferedPipe, opts: Option) {
		this._readyState = ReadyState.Closed;
		this._opts = opts || {};
		this._amtpClient = amtpClient;
		this._amtpChannel = null;
		this._tickHandlers = [];
		this._eventHandlers = [];

		this._permission = null;
		this._pushPipes = null;
		this._assignedPushPipes = null;
		this._pushPipeHandler = null;

		this._initPermission();
		this._initPushPipes();

		this._eventBuffer = [];
		this._bp = bufferedPipe;
	}

	/**
	 * AMFlowのセッションを開始する。
	 *
	 * 1. playlog-server に接続します。この際、UUID を生成しクエリパラメータとして送信します。
	 * 2. WebSocket コネクション上に AMTP セッションを確立します。
	 * 3. AMTP セッション上にプライマリな AMTP Channel を生成します。この AMTP Channel のラベルは `"playlog"` となります。以後、ここで生成した 1 本の AMTP Channel を利用してデータの送受信を行います。
	 * 4. 計 6 本の AMTP Push/Request Pipe の生成を行います。
	 * 5. Request Pipe の生成後、Request Pipe で、 `OpenRequest` の送信を行います。
	 * 6. 5 のレスポンスとして `OpenResponse` を受信及び、全パイプの生成を以って `open` が完了します。
	 *
	 * | Pipe の種類 | プライマリ | 生成元         | ドキュメント内での表記     |
	 * | :---------- | :--------- | :------------- | :------------------------- |
	 * | Push        | YES        | playlog-client | Primary Push Pipe          |
	 * | Push        | NO         | playlog-client | Secondary Push Pipe        |
	 * | Request     | YES        | playlog-client | Request Pipe               |
	 * | Push        | YES        | playlog-server | Primary Server Push Pipe   |
	 * | Push        | NO         | playlog-server | Secondary Server Push Pipe |
	 * | Request     | YES        | playlog-server | Server Request Pipe        |
	 *
	 */
	public open(playId: string, callback: (error?: Error) => void): void {
		if (this._readyState !== ReadyState.Closed) {
			setTimeout(() => callback(errors.createInvalidStateError("client is not closed")), 0);
			return;
		}
		this._readyState = ReadyState.Opening;
		this._open(playId, callback);
	}

	/**
	 * 開始済みのAMFlowのセッションを終了する。
	 *
	 * 1. Request Pipe で、 `CloseRequest` を playlog-server に送信します。
	 * 2. 1 のレスポンスとして `CloseResponse` を受信します。
	 * 3. engine.io 又は WebSocket コネクションと AMTP セッションを破棄します。
	 * `keepConnection` を `true` に指定した場合は、AMTP Channel の破棄のみとなります。
	 */
	public close(callback: (error?: Error) => void): void {
		if (this._readyState !== ReadyState.Open) {
			setTimeout(() => callback(errors.createInvalidStateError("client is not open")), 0);
			return;
		}
		this._readyState = ReadyState.Closing;
		const req = new Request.CloseRequest();
		this._bp.request(this._requestPipe, Request.encode(req), (err: amtp.ProtocolError, resData: Buffer) => {
			if (err) {
				return callback(errors.createRuntimeError("failed to request", err));
			}
			const res = Response.decode(resData) as Response.CloseResponse;
			if (res.error) {
				return callback(errors.createError(res.error.name, res.error.message));
			}
			this._closeAllPipes()
				.then(() => {
					this._amtpClient.closeChannel(this._amtpChannel, (err?: amtp.ProtocolError) => {
						if (err) {
							return callback(errors.createRuntimeError("failed to close channel", err));
						}
						this._readyState = ReadyState.Closed;
						this._cleanup();
						callback();
					});
				})
				.catch(() => {
					callback(errors.createRuntimeError("failed to close pipes"));
				});
		});
	}

	/**
	 * セッションの認証を要求する。
	 *
	 * 1. Request Pipe で、 `AuthenticateRequest` を playlog-server に送信します。
	 * 2. 1 のレスポンスとして `AuthenticateResponse` を受信します。
	 * 3. 2 で受信した `Permission` に応じて、Primary Push Pipe、Secondary Push Pipe、Primary Server Push Pipe、Secondary Server Push Pipe の役割を決定します。
	 * 4. 3 の完了を以って `authenticate` が完了します。
	 */
	public authenticate(token: string, callback: (error: Error, permission: amflow.Permission) => void): void {
		if (this._readyState !== ReadyState.Open) {
			setTimeout(() => callback(errors.createInvalidStateError("client is not open"), null), 0);
			return;
		}
		const wrappedCallback = (error: Error, permission: amflow.Permission) => {
			if (this._readyState === ReadyState.Open) {
				callback(error, permission);
			}
		};
		const req = new Request.AuthenticateRequest(token);
		this._bp.request(this._requestPipe, Request.encode(req), (err: amtp.ProtocolError, resData: Buffer) => {
			if (err) {
				return wrappedCallback(errors.createRuntimeError("failed to request", err), null);
			}
			const res = Response.decode(resData) as Response.AuthenticateResponse;
			if (res.error) {
				return wrappedCallback(errors.createError(res.error.name, res.error.message), null);
			}
			this._permission = res.permission;
			this._assignedPushPipes = this._pushPipeHandler.assign(this._permission);
			this._handleIncomingPipes();
			wrappedCallback(null, this._permission);
		});
	}

	/**
	 * `playlog.Tick` を送信する。
	 *
	 * Tick 送信用に割り当てられた AMTP Push Pipe にエンコードした Tick を送信します。
	 */
	public sendTick(tick: playlog.Tick): void {
		if (this._readyState !== ReadyState.Open) {
			throw errors.createInvalidStateError("client is not open");
		}
		if (!this._assignedPushPipes.sendTick) {
			throw errors.createPermissionError("no writeTick permission or pipe does not exists");
		}
		this._bp.push(this._assignedPushPipes.sendTick, amflowMessage.encodeTick(tick));
	}

	/**
	 * `playlog.Tick` の受信ハンドラを登録する。
	 *
	 * Tick 受信用に割り当てられた playlog-server が生成した AMTP Push Pipe から Tick を受信すると、 `onTick` で登録されたハンドラを呼び出します。
	 */
	public onTick(handler: (tick: playlog.Tick) => void): void {
		this._tickHandlers.push(handler);
	}

	/**
	 * `onTick` で登録した受信ハンドラの登録を解除する。
	 */
	public offTick(handler: (tick: playlog.Tick) => void): void {
		const handlers = this._tickHandlers;
		this._tickHandlers = [];
		for (let i = 0; i < handlers.length; ++i) {
			if (handlers[i] !== handler) {
				this._tickHandlers.push(handlers[i]);
			}
		}
	}

	/**
	 * `playlog.Event` を送信する。
	 *
	 * Event 送信用に割り当てられた AMTP Push Pipe にエンコードした Event を送信します。
	 */
	public sendEvent(event: playlog.Event): void {
		if (this._readyState !== ReadyState.Open) {
			throw errors.createInvalidStateError("client is not open");
		}
		if (!this._assignedPushPipes.sendEvent) {
			throw errors.createPermissionError("no sendEvent permission or pipe does not exists");
		}
		// NOTE: イベントの優先度上書きはサーバで行う
		this._bp.push(this._assignedPushPipes.sendEvent, amflowMessage.encodeEvent(event), true);
	}

	/**
	 * `playlog.Event` の受信ハンドラを登録する。
	 *
	 * Event 受信用に割り当てられた playlog-server が生成した AMTP Push Pipe から Event を受信すると、 `onEvent` で登録されたハンドラを呼び出します。
	 */
	public onEvent(handler: (event: playlog.Event) => void): void {
		this._eventHandlers.push(handler);
		if (this._eventBuffer.length) {
			const events = this._eventBuffer;
			this._eventBuffer = [];
			for (let i = 0; i < events.length; ++i) {
				handler(events[i]);
			}
		}
	}

	/**
	 * `onEvent` で登録した受信ハンドラの登録を解除する。
	 */
	public offEvent(handler: (event: playlog.Event) => void): void {
		const handlers = this._eventHandlers;
		this._eventHandlers = [];
		for (let i = 0; i < handlers.length; ++i) {
			if (handlers[i] !== handler) {
				this._eventHandlers.push(handlers[i]);
			}
		}
	}

	/**
	 * 保存された `playlog.Tick` のリスト `[from, to)` を取得する。
	 *
	 * 1. Request Pipe で、 `GetTickListRequest` を playlog-server に送信します。
	 * 2. 1 のレスポンスとして `GetTickListResponse` を受信します。
	 */
	public getTickList(
		beginOrOpts: number | amflow.GetTickListOptions,
		endOrCallback: number | getTickListCallback,
		callback?: getTickListCallback,
	): void {
		if (typeof beginOrOpts === "number" && typeof endOrCallback === "number") {
			this.getTickListImpl({ begin: beginOrOpts as number, end: endOrCallback as number }, callback);
		} else if (typeof beginOrOpts === "object" && typeof endOrCallback === "function") {
			this.getTickListImpl(beginOrOpts as amflow.GetTickListOptions, endOrCallback as getTickListCallback);
		} else {
			throw new Error("invalid argument exception");
		}
	}

	getTickListImpl(opts: amflow.GetTickListOptions, callback: getTickListCallback): void {
		const begin = opts.begin;
		const end = opts.end;
		const excludeEventFlags = opts.excludeEventFlags || { ignorable: false };

		if (this._readyState !== ReadyState.Open) {
			setTimeout(() => callback(errors.createInvalidStateError("client is not open"), null), 0);
			return;
		}
		const wrappedCallback = (error: Error, ticks: playlog.TickList) => {
			if (this._readyState === ReadyState.Open) {
				callback(error, ticks);
			}
		};
		if (this._permission.readTick) {
			const req = new Request.GetTickListRequest(begin, end, excludeEventFlags);
			this._bp.request(
				this._requestPipe,
				Request.encode(req),
				(err: amtp.ProtocolError, data: Buffer) => {
					if (err) {
						return wrappedCallback(errors.createRuntimeError("failed to request", err), null);
					}
					const res = Response.decode(data) as Response.GetTickListResponse;
					if (res.error) {
						return wrappedCallback(errors.createError(res.error.name, res.error.message), null);
					}
					wrappedCallback(null, res.tickList);
				},
				true,
			);
		} else {
			setTimeout(() => wrappedCallback(errors.createPermissionError("no readTick permission"), null), 0);
		}
	}
	/**
	 * 開始地点情報を保存する。
	 *
	 * 1. Request Pipe で、 `PutStartPointRequest` を playlog-server に送信します。
	 * 2. 1 のレスポンスとして `PutStartPointResponse` を受信します。
	 */
	public putStartPoint(startPoint: amflow.StartPoint, callback: (error: Error) => void): void {
		if (this._readyState !== ReadyState.Open) {
			setTimeout(() => callback(errors.createInvalidStateError("client is not open")), 0);
			return;
		}
		const wrappedCallback = (error: Error) => {
			if (this._readyState === ReadyState.Open) {
				callback(error);
			}
		};
		if (this._permission.writeTick) {
			const req = new Request.PutStartPointRequest(startPoint);
			this._bp.request(this._requestPipe, Request.encode(req), (err: amtp.ProtocolError, data: Buffer) => {
				if (err) {
					return wrappedCallback(errors.createRuntimeError("failed to request", err));
				}
				const res = Response.decode(data) as Response.PutStartPointResponse;
				if (res.error) {
					return wrappedCallback(errors.createError(res.error.name, res.error.message));
				}
				wrappedCallback(null);
			});
		} else {
			setTimeout(() => wrappedCallback(errors.createPermissionError("no writeTick permission")), 0);
		}
	}

	/**
	 * 保存された開始地点情報を取得する。
	 * オプションとしてフレーム番号を指定しない場合は、0フレーム目の開始地点情報を取得する。
	 * オプションとしてフレーム番号を指定した場合は、フレーム番号以前の直近の開始地点情報を取得する。
	 * オプションとしてtimestampを指定した場合は、timestampより小さい直近の開始地点情報を取得する。
	 *
	 * 1. Request Pipe で、 `GetStartPointRequest` `GetStartPointByTimestampRequest` を playlog-server に送信します。
	 * 2. 1 のレスポンスとして `GetStartPointResponse` を受信します。
	 */
	public getStartPoint(opts: amflow.GetStartPointOptions = {}, callback: (error: Error, startPoint: amflow.StartPoint) => void): void {
		if (this._readyState !== ReadyState.Open) {
			setTimeout(() => callback(errors.createInvalidStateError("client is not open"), null), 0);
			return;
		}
		const wrappedCallback = (error: Error, startPoint: amflow.StartPoint) => {
			if (this._readyState === ReadyState.Open) {
				callback(error, startPoint);
			}
		};
		if (this._permission.readTick || this._permission.writeTick) {
			const req = opts?.timestamp ? new Request.GetStartPointByTimestampRequest(opts) : new Request.GetStartPointRequest(opts);
			this._bp.request(
				this._requestPipe,
				Request.encode(req),
				(err: amtp.ProtocolError, data: Buffer) => {
					if (err) {
						return wrappedCallback(errors.createRuntimeError("failed to request", err), null);
					}
					const res = Response.decode(data) as Response.GetStartPointResponse;
					if (res.error) {
						return wrappedCallback(errors.createError(res.error.name, res.error.message), null);
					}
					wrappedCallback(null, res.startPoint);
				},
				true,
			);
		} else {
			setTimeout(() => wrappedCallback(errors.createPermissionError("no readTick permission"), null), 0);
		}
	}

	/**
	 * ストレージデータを保存する。
	 *
	 * 1. Request Pipe で、 `PutStorageDataRequest` を playlog-server に送信します。
	 * 2. 1 のレスポンスとして `PutStorageDataResponse` を受信します。
	 */
	public putStorageData(key: playlog.StorageKey, value: playlog.StorageValue, options: any = {}, callback: (err: Error) => void): void {
		if (this._readyState !== ReadyState.Open) {
			setTimeout(() => callback(errors.createInvalidStateError("client is not open")), 0);
			return;
		}
		const wrappedCallback = (error: Error) => {
			if (this._readyState === ReadyState.Open) {
				callback(error);
			}
		};
		if (this._permission.writeTick) {
			const req = new Request.PutStorageDataRequest(key, value, options);
			this._bp.request(this._requestPipe, Request.encode(req), (err: amtp.ProtocolError, data: Buffer) => {
				if (err) {
					return wrappedCallback(errors.createRuntimeError("failed to request", err));
				}
				const res = Response.decode(data) as Response.PutStorageDataResponse;
				if (res.error) {
					return wrappedCallback(errors.createError(res.error.name, res.error.message));
				}
				wrappedCallback(null);
			});
		} else {
			setTimeout(() => wrappedCallback(errors.createPermissionError("no writeTick permission")), 0);
		}
	}

	/**
	 * ストレージデータを取得する。
	 *
	 * 1. Request Pipe で、 `GetStorageDataRequest` を playlog-server に送信します。
	 * 2. 1 のレスポンスとして `GetStorageDataResponse` を受信します。
	 */
	public getStorageData(keys: playlog.StorageReadKey[], callback: (error: Error, values: playlog.StorageData[]) => void): void {
		if (this._readyState !== ReadyState.Open) {
			setTimeout(() => callback(errors.createInvalidStateError("client is not open"), null), 0);
			return;
		}
		const wrappedCallback = (error: Error, values: playlog.StorageData[]) => {
			if (this._readyState === ReadyState.Open) {
				callback(error, values);
			}
		};
		if (this._permission.writeTick) {
			const req = new Request.GetStorageDataRequest(keys);
			this._bp.request(
				this._requestPipe,
				Request.encode(req),
				(err: amtp.ProtocolError, data: Buffer) => {
					if (err) {
						return wrappedCallback(errors.createRuntimeError("failed to request", err), null);
					}
					const res = Response.decode(data) as Response.GetStorageDataResponse;
					if (res.error) {
						return wrappedCallback(errors.createError(res.error.name, res.error.message), null);
					}
					wrappedCallback(null, res.storageData);
				},
				true,
			);
		} else {
			setTimeout(() => wrappedCallback(errors.createPermissionError("no writeTick permission"), null), 0);
		}
	}

	public destroy(): void {
		this._cleanup();
		this._amtpClient = null;
	}

	private _open(playId: string, callback: (err: Error) => void): void {
		const primary = this._opts.usePrimaryChannel == null ? true : this._opts.usePrimaryChannel;
		this._amtpClient.createChannel({ primary, label: "playlog" }, (err: amtp.ProtocolError, ch: amtp.Channel) => {
			if (err) {
				return callback(errors.createRuntimeError("failed to create amtp channel", err));
			}
			this._amtpChannel = ch;
			this._openPipes(playId)
				.then(() => {
					this._readyState = ReadyState.Open;
					this._pushPipeHandler = new PushPipeHandler(this._pushPipes);
					callback(null);
				})
				.catch((err) => {
					callback(errors.createRuntimeError("failed to create amtp pipes", err));
				});
		});
	}
	private _openPipes(playId: string): Promise<void[]> {
		const tasks: Promise<void>[] = [];
		tasks.push(
			new Promise<void>((resolve, reject) => {
				this._amtpChannel.on("push-pipe", (pipe: amtp.IncomingPushPipe) => {
					if (pipe.isPrimary()) {
						if (this._pushPipes.incomingPrimary) {
							return reject(new Error("unexpected request to create push pipe"));
						}
						this._pushPipes.incomingPrimary = pipe;
					} else {
						if (this._pushPipes.incomingSecondary) {
							return reject(new Error("unexpected request to create push pipe"));
						}
						this._pushPipes.incomingSecondary = pipe;
					}
					if (this._pushPipes.incomingPrimary && this._pushPipes.incomingSecondary) {
						resolve();
					}
				});
			}),
		);
		tasks.push(
			new Promise<void>((resolve, reject) => {
				this._amtpChannel.on("request-pipe", (pipe: amtp.IncomingRequestPipe) => {
					if (!this._serverRequestPipe) {
						this._serverRequestPipe = pipe;
						resolve();
					} else {
						reject(new Error("unexpected request to create request pipe"));
					}
				});
			}),
		);
		tasks.push(
			new Promise<void>((resolve, reject) => {
				this._amtpChannel.createRequestPipe((err: Error, pipe: amtp.RequestPipe) => {
					if (err) {
						return reject(err);
					}
					this._requestPipe = pipe;
					const req = new Request.OpenRequest(playId);
					this._bp.request(this._requestPipe, Request.encode(req), (err: amtp.ProtocolError, data: Buffer) => {
						if (err) {
							return reject(err);
						}
						const res = Response.decode(data) as Response.OpenResponse;
						if (res.error) {
							return reject(errors.createError(res.error.name, res.error.message));
						}
						resolve();
					});
				});
			}),
		);
		tasks.push(
			new Promise<void>((resolve, reject) => {
				this._amtpChannel.createPushPipe({ primary: true }, (err: Error, pipe: amtp.PushPipe) => {
					if (err) {
						return reject(err);
					}
					this._pushPipes.primary = pipe;
					resolve();
				});
			}),
		);
		tasks.push(
			new Promise<void>((resolve, reject) => {
				this._amtpChannel.createPushPipe({ primary: false }, (err: Error, pipe: amtp.PushPipe) => {
					if (err) {
						return reject(err);
					}
					this._pushPipes.secondary = pipe;
					resolve();
				});
			}),
		);
		return Promise.all(tasks);
	}

	private _initPermission(): void {
		this._permission = {
			writeTick: false,
			readTick: false,
			sendEvent: false,
			subscribeEvent: false,
			subscribeTick: false,
			maxEventPriority: -1,
		};
	}

	private _initPushPipes(): void {
		this._pushPipes = {
			primary: null,
			secondary: null,
			incomingPrimary: null,
			incomingSecondary: null,
		};
	}

	private _onEvent(event: playlog.Event): void {
		if (this._readyState !== ReadyState.Open) {
			return;
		}
		if (!this._eventHandlers.length) {
			this._eventBuffer.push(event);
			return;
		}
		for (let i = 0; i < this._eventHandlers.length; ++i) {
			this._eventHandlers[i](event);
		}
	}

	private _onTick(tick: playlog.Tick): void {
		if (this._readyState !== ReadyState.Open) {
			return;
		}
		for (let i = 0; i < this._tickHandlers.length; ++i) {
			this._tickHandlers[i](tick);
		}
	}

	private _handleIncomingPipes(): void {
		const assigned = this._assignedPushPipes;
		if (assigned.subscribeEvent) {
			assigned.subscribeEvent.on("push", (data: Buffer) => {
				this._onEvent(amflowMessage.decodeEvent(data));
			});
		}
		if (assigned.subscribeTick) {
			assigned.subscribeTick.on("push", (data: Buffer) => {
				this._onTick(amflowMessage.decodeTick(data));
			});
		}
	}

	private _cleanup(): void {
		this._requestPipe = null;
		this._serverRequestPipe = null;
		this._assignedPushPipes = null;
		this._pushPipes.incomingPrimary.removeAllListeners();
		this._pushPipes.incomingSecondary.removeAllListeners();
		this._pushPipeHandler.destroy();
		this._amtpChannel.removeAllListeners();
		this._amtpChannel = null;
		this._initPushPipes();
		this._initPermission();
	}

	private _closeAllPipes(): Promise<any> {
		const tasks: Promise<void>[] = [];
		tasks.push(
			new Promise<void>((resolve, reject) => {
				this._requestPipe.close((err: amtp.ProtocolError) => {
					if (err) {
						reject(err);
					}
					resolve();
				});
			}),
		);
		tasks.push(
			new Promise<void>((resolve, reject) => {
				this._pushPipes.primary.close((err: amtp.ProtocolError) => {
					if (err) {
						reject(err);
					}
					resolve();
				});
			}),
		);
		tasks.push(
			new Promise<void>((resolve, reject) => {
				this._pushPipes.secondary.close((err: amtp.ProtocolError) => {
					if (err) {
						reject(err);
					}
					resolve();
				});
			}),
		);
		return Promise.all(tasks);
	}
}
