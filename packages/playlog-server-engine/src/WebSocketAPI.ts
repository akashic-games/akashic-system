import * as events from "events";
import ws = require("ws");

// WebSocket API wrapper for ws on Node.
export class WebSocketAPI extends events.EventEmitter implements WebSocket {
	public binaryType: BinaryType;
	public bufferedAmount: number;
	public extensions: string;
	public onclose: (ev: CloseEvent) => any;
	public onerror: (err: Event) => any;
	public onmessage: (ev: MessageEvent) => any;
	public onopen: (ev: Event) => any;
	public protocol: string;
	public readyState: number;
	public url: string;
	public CLOSED: number;
	public CLOSING: number;
	public CONNECTING: number;
	public OPEN: number;

	public _socket: ws;
	public _listeners: {
		onOpen(): void;
		onClose(): void;
		onMessage(data: any, flags: { binary: boolean }): void;
		onError(err: Error): void;
	};

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
			onMessage: (data: any) => {
				this._onMessage(data);
			},
			onError: (err: Error) => {
				this._onError(err);
			},
		};
		this._socket = new ws(this.url);
		this._socket.on("open", this._listeners.onOpen);
		this._socket.on("close", this._listeners.onClose);
		this._socket.on("message", this._listeners.onMessage);
		this._socket.on("error", this._listeners.onError);
	}

	public addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
		if (type === "error") {
			type = "error-event";
		}
		this.on(type, listener as any);
	}

	public dispatchEvent(): boolean {
		throw new Error("not implemented");
	}

	public removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
		if (type === "error") {
			type = "error-event";
		}
		this.removeListener(type, listener as any);
	}

	public close(): void {
		this._socket.close();
	}

	public send(data: any): void {
		this._socket.send(data, { binary: true, mask: true });
	}

	public _onOpen(): void {
		if (this.onopen) {
			this.onopen(null);
		}
		this.emit("open");
	}

	public _onClose(): void {
		if (this.onclose) {
			this.onclose(null);
		}
		this.emit("close");
	}

	public _onMessage(data: any): void {
		const ev = { data } as MessageEvent;
		if (this.onmessage) {
			this.onmessage(ev);
		}
		this.emit("message", ev);
	}

	public _onError(_: Error): void {
		const ev = { type: "error" } as ErrorEvent;
		if (this.onerror) {
			this.onerror(ev);
		}
		this.emit("error-event", ev);
	}
}
