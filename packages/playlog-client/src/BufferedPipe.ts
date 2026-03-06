import * as amtp from "@akashic/amtplib";
import * as events from "events";
import * as Socket from "./Socket";

export class BufferedPipe extends events.EventEmitter {
	private _socket: Socket.Socket;
	private _needsBuffering: boolean;
	private _buffer: (() => void)[];
	private _bufferMaxSize: number;

	constructor(socket: Socket.Socket, bufferMaxSize: number) {
		super();
		this._socket = socket;
		this._needsBuffering = false;
		this._buffer = [];
		this._bufferMaxSize = bufferMaxSize;
		this.handleSocket();
	}

	public push(pipe: amtp.PushPipe, data: Buffer, noBuffering?: boolean): void {
		if (this._needsBuffering) {
			if (!noBuffering) {
				if (this._buffer.length >= this._bufferMaxSize) {
					this.emit("limit");
					return;
				}
				this._buffer.push(() => {
					pipe.push(data);
				});
			}
		} else {
			pipe.push(data);
		}
	}

	public request(
		pipe: amtp.RequestPipe,
		data: Buffer,
		callback: (err: amtp.ProtocolError, data: Buffer) => void,
		noBuffering?: boolean,
	): void {
		if (this._needsBuffering) {
			if (!noBuffering) {
				if (this._buffer.length >= this._bufferMaxSize) {
					this.emit("limit");
					return;
				}
				this._buffer.push(() => {
					pipe.request(data, callback);
				});
			}
		} else {
			pipe.request(data, callback);
		}
	}

	private handleSocket(): void {
		this._socket.on("reopening", () => {
			this._needsBuffering = true;
		});
		this._socket.on("open", () => {
			this._needsBuffering = false;
			const buf = this._buffer;
			this._buffer = [];
			buf.forEach((b) => b());
		});
		this._socket.on("close", () => {
			this._needsBuffering = false;
			this._buffer = [];
		});
	}
}
