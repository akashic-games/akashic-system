import assert from "assert";
import { EventEmitter } from "events";
import { Channel } from "./Channel";
import * as errors from "./Error";
import { ReadyState } from "./ReadyState";

export class RequestPipeResponse {
	public _requestId: number;
	public _pipe: IncomingRequestPipe;
	constructor(requestId: number, pipe: IncomingRequestPipe) {
		this._requestId = requestId;
		this._pipe = pipe;
	}
	public end(data: Buffer): void {
		this._pipe._response(this._requestId, data);
		this._requestId = null;
		this._pipe = null;
	}
}

export interface Pipe {
	channel: Channel;
	id: number;
	label: string;
	readyState: ReadyState;
	isPrimary(): boolean;
	_destroy(): void;
}

export class PipeImpl implements Pipe {
	public channel: Channel;
	public id: number;
	public label: string;
	public readyState: ReadyState;
	constructor(channel: Channel, id: number, label: string) {
		this.channel = channel;
		this.id = id;
		this.label = label;
		this.readyState = ReadyState.Open;
	}
	public isPrimary(): boolean {
		throw new errors.PureVirtualError();
	}
	public _destroy(): void {
		this.channel = null;
		this.id = null;
	}
}

export class IncomingPipeImpl extends EventEmitter implements Pipe {
	public channel: Channel;
	public id: number;
	public label: string;
	public readyState: ReadyState;
	constructor(channel: Channel, id: number, label: string) {
		super();
		this.channel = channel;
		this.id = id;
		this.label = label;
		this.readyState = ReadyState.Open;
	}
	public isPrimary(): boolean {
		throw new errors.PureVirtualError();
	}
	public _destroy(): void {
		this.channel = null;
		this.id = null;
	}
}

export class PushPipe extends PipeImpl {
	public push(data: Buffer): void {
		if (this.readyState !== ReadyState.Open) {
			throw new errors.InvalidStateError(`push pipe ( id: ${this.id}, chId: ${this.channel.id} ) is already closed.`);
		}
		this.channel._session.sendPushPipeData(this.channel.id, this.id, data);
	}
	public close(callback?: (err: errors.ProtocolError) => void): void {
		this.readyState = ReadyState.Closing;
		this.channel._closePushPipe(this, (err: errors.ProtocolError) => {
			this.readyState = ReadyState.Closed;
			if (callback) {
				callback(err);
			}
		});
	}
	public isPrimary(): boolean {
		return this.channel._isPrimaryPushPipe(this);
	}
}

export class IncomingPushPipe extends IncomingPipeImpl {
	public on(event: "close", listener: () => void): this;
	public on(event: "push", listener: (data: Buffer) => void): this;
	public on(event: string, listener: (...args: any[]) => void): this {
		return super.on(event, listener);
	}
	public isPrimary(): boolean {
		return this.channel._isPrimaryIncomingPushPipe(this);
	}
	public _onPush(data: Buffer): void {
		this.emit("push", data);
	}
	public _onClose(): void {
		this.emit("close");
	}
	public _destroy(): void {
		super._destroy();
		this.removeAllListeners();
	}
}

export class RequestPipe extends PipeImpl {
	private _reqIdx: number;
	private _handlers: { [id: number]: (err: errors.ProtocolError, data?: Buffer) => void };
	constructor(channel: Channel, id: number, label: string) {
		super(channel, id, label);
		this._reqIdx = channel._isClientMode ? 1 : 2;
		this._handlers = {};
	}
	public request(data: Buffer, callback: (err: errors.ProtocolError, data?: Buffer) => void): void {
		assert(this.readyState === ReadyState.Open);
		this._handlers[this._reqIdx] = callback;
		this.channel._session.sendRequestPipeData(this.channel.id, this.id, this._reqIdx, data);
		this._reqIdx += 2;
	}
	public close(callback?: (err: errors.ProtocolError) => void): void {
		this.readyState = ReadyState.Closing;
		this.channel._closeRequestPipe(this, (err: errors.ProtocolError) => {
			this.readyState = ReadyState.Closed;
			if (callback) {
				callback(err);
			}
		});
	}
	public isPrimary(): boolean {
		return this.channel._isPrimaryRequestPipe(this);
	}
	public _onResponse(requestId: number, data: Buffer): void {
		assert(this.readyState === ReadyState.Open);
		const handler = this._handlers[requestId];
		this._handlers[requestId] = null;
		handler(null, data);
	}
	public _destroy(): void {
		super._destroy();
		this._reqIdx = null;
		this._handlers = null;
	}
}

export class IncomingRequestPipe extends IncomingPipeImpl {
	public on(event: "close", listener: () => void): this;
	public on(event: "request", listener: (data: Buffer, res: RequestPipeResponse) => void): this;
	public on(event: string, listener: (...args: any[]) => void): this {
		return super.on(event, listener);
	}
	public isPrimary(): boolean {
		return this.channel._isPrimaryIncomingRequestPipe(this);
	}
	public _response(requestId: number, data: Buffer): void {
		assert(this.readyState === ReadyState.Open);
		this.channel._session.sendIncomingRequestPipeData(this.channel.id, this.id, requestId, data);
	}
	public _onRequest(requestId: number, data: Buffer): void {
		assert(this.readyState === ReadyState.Open);
		this.emit("request", data, new RequestPipeResponse(requestId, this));
	}
	public _onClose(): void {
		this.readyState = ReadyState.Closed;
		this.emit("close");
	}
	public _destroy(): void {
		super._destroy();
		this.removeAllListeners();
	}
}
