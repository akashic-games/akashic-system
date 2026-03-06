const ws = require("ws");
const events = require("events");

export default class WebSocketAPI extends (events.EventEmitter as new () => any) {
	public CONNECTING: number;
	public OPEN: number;
	public CLOSING: number;
	public CLOSED: number;
	public url: string;
	public _listeners: {
		[index: string]: (...props: any[]) => void;
	};
	public _socket: any;
	constructor(url: string) {
		super();
		this.CONNECTING = 0;
		this.OPEN = 1;
		this.CLOSING = 2;
		this.CLOSED = 3;
		this.url = url;
		this._listeners = {
			onOpen: () => {
				this._onOpen();
			},
			onClose: () => {
				this._onClose();
			},
			onMessage: (data, flags) => {
				this._onMessage(data, flags);
			},
			onError: (err) => {
				this._onError(err);
			},
		};
		this._socket = new ws(this.url);
		this._socket.on("open", this._listeners.onOpen);
		this._socket.on("close", this._listeners.onClose);
		this._socket.on("message", this._listeners.onMessage);
		this._socket.on("error", this._listeners.onError);
	}

	public addEventListener(type, listener, useCapture) {
		if (type === "error") {
			type = "error-event";
		}
		this.on(type, listener);
	}
	public dispatchEvent(evt) {
		throw new Error("not implemented");
	}
	public removeEventListener(type, listener, useCapture) {
		if (type === "error") {
			type = "error-event";
		}
		this.removeListener(type, listener);
	}
	public close(code, reason) {
		this._socket.close();
	}
	public send(data) {
		this._socket.send(data, { binary: true, mask: true });
	}
	public _onOpen() {
		if (this.onopen) {
			this.onopen(null);
		}
		this.emit("open");
	}
	public _onClose() {
		if (this.onclose) {
			this.onclose(null);
		}
		this.emit("close");
	}
	public _onMessage(data, flags) {
		const ev = { data };
		if (this.onmessage) {
			this.onmessage(ev);
		}
		this.emit("message", ev);
	}
	public _onError(err) {
		const ev = { type: "error" };
		if (this.onerror) {
			this.onerror(ev);
		}
		this.emit("error-event", ev);
	}
}
