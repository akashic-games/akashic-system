import { EventEmitter } from "events";
import { Channel } from "./Channel";
import * as errors from "./Error";
import { ServerSession } from "./Session";
import { Socket } from "./Socket";

export class Server extends EventEmitter {
	private _session: ServerSession;
	constructor(socket: Socket) {
		super();
		this._session = new ServerSession(socket);
		this._session.on("open", () => {
			this._onOpen();
		});
		this._session.on("channel", (channel: Channel) => {
			this._onChannel(channel);
		});
		this._session.on("error", (error: errors.ProtocolError) => {
			this._onError(error);
		});
		this._session.on("close", () => {
			this._onClose();
		});
	}
	public close(callback?: (err?: errors.ProtocolError) => void): void {
		this._session.close(callback);
	}
	private _onOpen(): void {
		this.emit("open");
	}
	private _onChannel(channel: Channel): void {
		this.emit("channel", channel);
	}
	private _onError(error: errors.ProtocolError): void {
		this.emit("error", error);
	}
	private _onClose(): void {
		this.emit("close");
	}
}
