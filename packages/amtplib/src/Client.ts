import { EventEmitter } from "events";
import { Channel } from "./Channel";
import { ProtocolError } from "./Error";
import * as errors from "./Error";
import { ClientSession } from "./Session";
import { Socket } from "./Socket";

export class Client extends EventEmitter {
	private _session: ClientSession;
	constructor(socket: Socket) {
		super();
		this._session = new ClientSession(socket);
		this._session.on("error", (error: errors.ProtocolError) => {
			this._onError(error);
		});
		this._session.on("close", () => {
			this._onClose();
		});
	}
	public open(callback: (err: ProtocolError) => void): void {
		this._session.open(callback);
	}
	public close(callback?: (err?: ProtocolError) => void): void {
		this._session.close(callback);
	}
	public createChannel(opts: { primary?: boolean; label?: string }, callback: (err: ProtocolError, channel?: Channel) => void): void;
	public createChannel(callback: (err: ProtocolError, channel?: Channel) => void): void;
	public createChannel(opts: any, callback?: (err: ProtocolError, channel?: Channel) => void): void {
		if (typeof opts === "function") {
			callback = opts;
			opts = { primary: false, label: "" };
		}
		if (!opts.label) {
			opts.label = "";
		}
		this._session.createChannel(opts.primary, opts.label, callback);
	}
	public closeChannel(ch: Channel, callback?: (error?: errors.ProtocolError) => void): void {
		this._session.closeChannel(ch, callback);
	}
	private _onError(error: errors.ProtocolError): void {
		this.emit("error", error);
	}
	private _onClose(): void {
		this.emit("close");
	}
}
