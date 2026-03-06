import { EventEmitter } from "events";
import WS from "ws";

/**
 * node.js上でweb標準のWebSocketのふりをするオブジェクト
 */
export class WebSocketAPI extends EventEmitter {
	readonly CONNECTING = 0;
	readonly OPEN = 1;
	readonly CLOSING = 2;
	readonly CLOSED = 3;
	onclose: ((ev: CloseEvent) => any) | null = null;
	onerror: ((ev: Event) => any) | null = null;
	onmessage: ((ev: MessageEvent) => any) | null = null;
	onopen: ((ev: Event) => any) | null = null;
	private readonly url: string;
	private readonly _socket: WS;
	private readonly _listeners: { onOpen: () => void; onClose: () => void; onMessage: (data: any) => void; onError: (err: Error) => void };

	constructor(url: string) {
		super();
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
			onError: () => {
				this._onError();
			},
		};
		this._socket = new WS(this.url);
		this._socket.on("open", this._listeners.onOpen);
		this._socket.on("close", this._listeners.onClose);
		this._socket.on("message", this._listeners.onMessage);
		this._socket.on("error", this._listeners.onError);
	}

	addEventListener<K extends keyof WebSocketEventMap>(type: K, listener: (this: WebSocket, ev: WebSocketEventMap[K]) => any): void {
		if (type === "error") {
			this.on("error-event", listener);
		} else {
			this.on(type, listener);
		}
	}

	dispatchEvent(): void {
		throw new Error("not implemented");
	}

	removeEventListener<K extends keyof WebSocketEventMap>(type: K, listener: (this: WebSocket, ev: WebSocketEventMap[K]) => any): void {
		if (type === "error") {
			this.removeListener("error-event", listener);
		} else {
			this.removeListener(type, listener);
		}
	}

	close(): void {
		this._socket.close();
	}

	send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
		// domとwsで型が違うので無理やり変換
		this._socket.send(data as unknown as ArrayBufferLike, { binary: true, mask: true });
	}

	_onOpen() {
		if (this.onopen) {
			this.onopen({} as any);
		}
		this.emit("open");
	}

	_onClose() {
		if (this.onclose) {
			this.onclose({} as any);
		}
		this.emit("close");
	}

	_onMessage(data: any) {
		var ev = { data: data };
		if (this.onmessage) {
			this.onmessage(ev as any);
		}
		this.emit("message", ev);
	}

	_onError() {
		var ev = { type: "error" };
		if (this.onerror) {
			this.onerror(ev as any);
		}
		this.emit("error-event", ev);
	}
}
