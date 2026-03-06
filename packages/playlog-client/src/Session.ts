import * as amtp from "@akashic/amtplib";
import assert from "assert";
import * as events from "events";
import * as BufferedPipe from "./BufferedPipe";
import * as Client from "./Client";
import * as controlMessage from "./SessionControlMessage";
import * as Socket from "./Socket";

enum ReadyState {
	Closed,
	Closing,
	Opening,
	Open,
}

export interface Option {
	/**
	 * 再接続中の送信データをバッファする数。
	 */
	bufferSize?: number;
	socketType?: Socket.Type;
	socketOpts?: Socket.Option;
	validationData?: { playId: string; token: string };
}

/**
 * `Session` は `playlog-server` との接続単位に相当します。
 * `Session` を制御するために、1 本の AMTP Channel が生成されます。この AMTP Channel のラベルは `"session_control"` となります。
 * 接続先の `playlog-server` によっては、`Session#open` 呼び出し時に `Session` のバリデーションを行う必要があります。
 */
export class Session extends events.EventEmitter {
	public amtpClient: amtp.Client;

	private _readyState: ReadyState;
	private _url: string;
	private _opts: Option;
	private _controlChannel: amtp.Channel;
	private _controlRequestPipe: amtp.RequestPipe;
	private _controlServerPushPipe: amtp.IncomingPushPipe;
	private _bufferedPipe: BufferedPipe.BufferedPipe;

	private _socket: Socket.Socket;
	private _socketListener: {
		onError: (err: any) => void;
		onClose: () => void;
	};

	constructor(url: string, opts?: Option) {
		super();
		this._readyState = ReadyState.Closed;
		this._url = url;
		this._socket = null;
		this._opts = opts || {};
		if (this._opts.socketType == null) {
			this._opts.socketType = Socket.Type.WebSocket;
		}
		if (this._opts.bufferSize == null) {
			this._opts.bufferSize = 100000;
		}
		this.amtpClient = null;
		this._controlChannel = null;
		this._controlRequestPipe = null;
		this._controlServerPushPipe = null;
		this._socketListener = {
			onError: (error: any): void => {
				this.emit("error", error);
			},
			onClose: (): void => {
				this._onSocketClose();
			},
		};
		this._bufferedPipe = null;
	}
	public open(callback: (error?: Error) => void): void {
		switch (this._opts.socketType) {
			case Socket.Type.WebSocket:
				if ("WebSocket" in global) {
					this._socket = new Socket.WSSocket(this._url, this._opts.socketOpts);
				} else {
					setTimeout(() => callback(new Error("WebSocket is not supported.")), 0);
					return;
				}
				break;
			default:
				setTimeout(() => callback(new Error("unknown socket type: " + Socket.Type[this._opts.socketType])), 0);
				return;
		}
		this._readyState = ReadyState.Opening;
		this._socket.once("open", () => {
			this._createAMTPClient()
				.then(() => {
					return this._createControlChannel();
				})
				.then(() => {
					return this._requestEstablish();
				})
				.then((uid) => {
					this._socket.setUID(uid);
					this._readyState = ReadyState.Open;
					if (this._opts.validationData) {
						return this._requestValidate(this._opts.validationData);
					} else {
						return null;
					}
				})
				.then(() => {
					this._bufferedPipe = new BufferedPipe.BufferedPipe(this._socket, this._opts.bufferSize);
					this._bufferedPipe.on("limit", () => {
						this._onBufferedPipeLimit();
					});
					callback();
				})
				.catch((e) => {
					this._socket.close();
					if (!e) {
						e = new Error("failed to open session");
					}
					callback(e);
				});
		});
		this._socket.on("close", this._socketListener.onClose);
		this._socket.on("error", this._socketListener.onError);
		this._socket.open();
	}
	public createClient(opts: Client.Option, callback: (error: Error, client?: Client.Client) => void): void;
	public createClient(callback: (error: Error, client?: Client.Client) => void): void;
	public createClient(opts: any, callback?: (error: Error, client?: Client.Client) => void): void {
		if (typeof opts === "function") {
			callback = opts;
			opts = null;
		}
		if (this._readyState !== ReadyState.Open) {
			setTimeout(() => callback(new Error("the session is not open")), 0);
		} else {
			const wrappedCallback = (error: Error, client?: Client.Client) => {
				if (this._readyState === ReadyState.Open) {
					callback(error, client);
				}
			};
			setTimeout(() => wrappedCallback(null, new Client.Client(this.amtpClient, this._bufferedPipe, opts)), 0);
		}
	}
	public close(callback: (error?: Error) => void): void {
		if (this._readyState === ReadyState.Closed) {
			setTimeout(() => callback(new Error("the session already closed")), 0);
			return;
		}
		this.amtpClient.close((error?: Error) => {
			if (error) {
				callback(new Error("failed to close"));
				return;
			}
			this._socket.once("close", () => {
				callback();
			});
			this._socket.close();
		});
	}
	private _createAMTPClient(): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			const client = new amtp.Client(this._socket);
			client.open((error: any) => {
				if (error) {
					reject(new Error("failed to open AMTP client"));
				} else {
					this.amtpClient = client;
					resolve();
				}
			});
		});
	}
	private _createControlChannel(): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			this.amtpClient.createChannel({ label: "session_control" }, (error, channel) => {
				if (error) {
					return reject(error);
				}
				this._controlChannel = channel;
				resolve();
			});
		})
			.then(() => {
				const tasks: Promise<void>[] = [];
				tasks.push(
					new Promise<void>((resolve) => {
						this._controlChannel.once("push-pipe", (pipe: amtp.IncomingPushPipe) => {
							this._controlServerPushPipe = pipe;
							this._controlServerPushPipe.on("push", (data: Buffer) => {
								this._onControlMessage(data);
							});
							resolve();
						});
					}),
				);
				tasks.push(
					new Promise<void>((resolve, reject) => {
						this._controlChannel.createRequestPipe((error, pipe) => {
							if (error) {
								return reject(error);
							}
							this._controlRequestPipe = pipe;
							resolve();
						});
					}),
				);
				return Promise.all(tasks);
			})
			.then(() => {
				// returns void
			});
	}
	private _requestEstablish(): Promise<string> {
		const req = new controlMessage.EstablishRequestMessage();
		return new Promise<string>((resolve, reject) => {
			this._controlRequestPipe.request(req.toBytes(), (err, data) => {
				if (err) {
					return reject(err);
				}
				const res = controlMessage.toResponseMessage(data);
				assert(res.code === controlMessage.ControlCode.Establish);
				const uid = (res as controlMessage.EstablishResponseMessage).uid;
				if (uid) {
					resolve(uid);
				} else {
					reject(new Error("failed to establish session"));
				}
			});
		});
	}
	private _requestValidate(data: { playId: string; token: string }): Promise<void> {
		const req = new controlMessage.ValidateRequestMessage(data.playId, data.token);
		return new Promise<void>((resolve, reject) => {
			this._controlRequestPipe.request(req.toBytes(), (err, data) => {
				if (err) {
					return reject(err);
				}
				const res = controlMessage.toResponseMessage(data);
				assert(res.code === controlMessage.ControlCode.Validate);
				const success = (res as controlMessage.ValidateResponseMessage).success;
				if (success) {
					resolve();
				} else {
					reject(new Error("failed to validate session"));
				}
			});
		});
	}
	private _onControlMessage(data: Buffer): void {
		// TODO: 現状特に用途が無いが、playlog-serverからセッション制御用データがpushされてくる時に使う
		this.emit("control", data.toString());
	}
	private _onSocketClose(): void {
		this._socket = null;
		if (this._readyState !== ReadyState.Closed) {
			this._readyState = ReadyState.Closed;
		}
	}
	private _onBufferedPipeLimit(): void {
		this.emit("error", new Error("buffer limit exceeded"));
	}
}
