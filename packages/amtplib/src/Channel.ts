import assert from "assert";
import { EventEmitter } from "events";

import * as errors from "./Error";
import * as pipes from "./Pipe";
import { PrimaryHolder } from "./PrimaryHolder";
import { ReadyState } from "./ReadyState";
import { Session } from "./Session";
import * as utils from "./utils";

export class Channel extends EventEmitter {
	public id: number;
	public label: string;
	public _session: Session;
	public _isClientMode: boolean;

	public _pushPipes: { [id: number]: pipes.PushPipe };
	public _incomingPushPipes: { [id: number]: pipes.IncomingPushPipe };

	public _requestPipes: { [id: number]: pipes.RequestPipe };
	public _incomingRequestPipes: { [id: number]: pipes.IncomingRequestPipe };

	public _primaryIncomingPushPipe: pipes.IncomingPushPipe;
	public _primaryPushPipe: pipes.PushPipe;

	public _primaryIncomingRequestPipe: pipes.IncomingRequestPipe;
	public _primaryRequestPipeHolder: PrimaryHolder<pipes.RequestPipe>;

	public readyState: ReadyState;

	private _pushPipeIdx: number;
	private _requestPipeIdx: number;

	constructor(id: number, isClientMode: boolean, session: Session, label: string) {
		super();
		this.id = id;
		this.label = label;
		this._isClientMode = isClientMode;
		this._session = session;

		this._pushPipes = {};
		this._incomingPushPipes = {};

		this._primaryPushPipe = null;
		this._primaryIncomingPushPipe = null;

		this._requestPipes = {};
		this._incomingRequestPipes = {};

		this._primaryRequestPipeHolder = new PrimaryHolder<pipes.RequestPipe>();
		this._primaryIncomingRequestPipe = null;

		this._pushPipeIdx = 1;
		this._requestPipeIdx = 1;

		this.readyState = ReadyState.Open;
	}

	public createPushPipe(opts: { primary?: boolean; label?: string }, callback: (err: Error, pipe: pipes.PushPipe) => void): void;
	public createPushPipe(callback: (err: Error, pipe: pipes.PushPipe) => void): void;
	public createPushPipe(opts: any, callback?: (err: Error, pipe: pipes.PushPipe) => void): void {
		assert(this.readyState === ReadyState.Open, "channel is not open");
		if (typeof opts === "function") {
			callback = opts;
			opts = { primary: false, label: "" };
		}
		if (opts.primary) {
			this._primaryPushPipe = null;
		}
		if (!opts.label) {
			opts.label = "";
		}
		this._session.createPipe(this.id, this._pushPipeIdx, opts.primary, false, opts.label, (err: errors.ProtocolError, pipeId: number) => {
			if (err) {
				callback(err, null);
				return;
			}
			const p = new pipes.PushPipe(this, pipeId, opts.label);
			this._pushPipes[pipeId] = p;
			if (opts.primary) {
				this._primaryPushPipe = p;
			} else {
				if (!this._primaryPushPipe) {
					const pId = utils.detectOpenStatusMinimumId(this._requestPipes);
					this._primaryPushPipe = this._pushPipes[pId];
				}
			}
			callback(null, p);
		});
		this._pushPipeIdx++;
	}

	public createRequestPipe(opts: { primary?: boolean; label?: string }, callback: (err: Error, pipe: pipes.RequestPipe) => void): void;
	public createRequestPipe(callback: (err: Error, pipe: pipes.RequestPipe) => void): void;
	public createRequestPipe(opts: any, callback?: (err: Error, pipe: pipes.RequestPipe) => void): void {
		assert(this.readyState === ReadyState.Open, "channel is not open");
		if (typeof opts === "function") {
			callback = opts;
			opts = { primary: false, label: "" };
		}
		if (opts.primary) {
			this._primaryRequestPipeHolder.setSend(null);
		}
		if (!opts.label) {
			opts.label = "";
		}
		this._session.createPipe(this.id, this._requestPipeIdx, opts.primary, true, opts.label, (err: errors.ProtocolError, pipeId: number) => {
			if (err) {
				callback(err, null);
				return;
			}
			const p = new pipes.RequestPipe(this, pipeId, opts.label);
			this._requestPipes[pipeId] = p;
			if (opts.primary) {
				this._primaryRequestPipeHolder.set(p, p);
			} else {
				const pipeId = utils.detectOpenStatusMinimumId(this._requestPipes);
				const pp = this._requestPipes[pipeId];
				assert(pp);
				if (!this._primaryRequestPipeHolder.send) {
					this._primaryRequestPipeHolder.setSend(pp);
				}
				if (!this._primaryRequestPipeHolder.recv) {
					this._primaryRequestPipeHolder.setRecv(pp);
				}
			}
			callback(null, p);
		});
		this._requestPipeIdx++;
	}

	public isPrimary(): boolean {
		return this._session.isPrimaryChannel(this);
	}

	public _closePushPipe(pipe: pipes.PushPipe, callback: (err: errors.ProtocolError) => void): void {
		if (this._primaryPushPipe === pipe) {
			const pId = utils.detectOpenStatusMinimumId(this._pushPipes);
			if (pId === null) {
				this._primaryPushPipe = null;
			} else {
				this._primaryPushPipe = this._pushPipes[pId];
			}
		}
		this._session.closePipe(this.id, pipe.id, false, (err: errors.ProtocolError) => {
			if (err) {
				callback(new errors.ProtocolError(`failed to close push pipe ( id: ${pipe.id}, chId: ${this.id} )`));
			} else {
				delete this._pushPipes[pipe.id];
				callback(null);
				pipe._destroy();
			}
		});
	}

	public _closeRequestPipe(pipe: pipes.RequestPipe, callback: (err: errors.ProtocolError) => void): void {
		if (this._primaryRequestPipeHolder.send === pipe) {
			const pId = utils.detectOpenStatusMinimumId(this._requestPipes);
			if (pId === null) {
				this._primaryRequestPipeHolder.send = null;
			} else {
				this._primaryRequestPipeHolder.send = this._requestPipes[pId];
			}
		}
		this._session.closePipe(this.id, pipe.id, true, (err: errors.ProtocolError) => {
			if (err) {
				callback(new errors.ProtocolError(`failed to close request pipe ( id: ${pipe.id}, chId: ${this.id} )`));
			} else {
				if (this._primaryRequestPipeHolder.recv === pipe) {
					const pId = utils.detectOpenStatusMinimumId(this._requestPipes);
					this._primaryRequestPipeHolder.recv = this._requestPipes[pId];
				}
				delete this._requestPipes[pipe.id];
				callback(null);
				pipe._destroy();
			}
		});
	}

	public _createIncomingPushPipe(id: number, primary: boolean, label: string): void {
		if (this._incomingPushPipes[id]) {
			throw new errors.InvalidStateError(`push pipe ${id} for incoming already exists on channel ${this.id}`);
		}
		const p = new pipes.IncomingPushPipe(this, id, label);
		this._incomingPushPipes[id] = p;
		if (primary) {
			this._primaryIncomingPushPipe = p;
		} else {
			if (!this._primaryIncomingPushPipe) {
				const pId = utils.detectOpenStatusMinimumId(this._incomingPushPipes);
				assert(pId !== null, "primary push pipe id is null");
				this._primaryIncomingPushPipe = this._incomingPushPipes[pId];
			}
		}
		this.emit("push-pipe", p);
	}

	public _closeIncomingPushPipe(id: number): void {
		const p = this._incomingPushPipes[id];
		assert(p, "incoming push pipe for close is null");
		delete this._incomingPushPipes[id];
		if (this._primaryIncomingPushPipe === p) {
			const pId = utils.detectOpenStatusMinimumId(this._incomingPushPipes);
			if (pId === null) {
				this._primaryIncomingPushPipe = null;
			} else {
				this._primaryIncomingPushPipe = this._incomingPushPipes[pId];
			}
		}
		p._onClose();
		p._destroy();
	}

	public _createIncomingRequestPipe(id: number, primary: boolean, label: string): void {
		if (this._incomingRequestPipes[id]) {
			throw new errors.InvalidStateError(`request pipe ${id} for incoming already exists on channel ${this.id}`);
		}
		const p = new pipes.IncomingRequestPipe(this, id, label);
		this._incomingRequestPipes[id] = p;
		if (primary) {
			this._primaryIncomingRequestPipe = p;
		} else {
			if (!this._primaryIncomingRequestPipe) {
				const pId = utils.detectOpenStatusMinimumId(this._incomingRequestPipes);
				assert(pId !== null, "primary request pipe id is null");
				this._primaryIncomingRequestPipe = this._incomingRequestPipes[pId];
			}
		}
		this.emit("request-pipe", p);
	}

	public _closeIncomingRequestPipe(id: number): void {
		const p = this._incomingRequestPipes[id];
		assert(p, "incoming request pipe for close is null");
		delete this._incomingRequestPipes[id];
		if (this._primaryIncomingRequestPipe === p) {
			const pId = utils.detectOpenStatusMinimumId(this._incomingRequestPipes);
			if (pId === null) {
				this._primaryIncomingRequestPipe = null;
			} else {
				this._primaryIncomingRequestPipe = this._incomingRequestPipes[pId];
			}
		}
		p._onClose();
		p._destroy();
	}

	public _isPrimaryIncomingPushPipe(pipe: pipes.IncomingPushPipe): boolean {
		return this._primaryIncomingPushPipe === pipe;
	}

	public _isPrimaryPushPipe(pipe: pipes.PushPipe): boolean {
		return this._primaryPushPipe === pipe;
	}

	public _isPrimaryIncomingRequestPipe(pipe: pipes.IncomingRequestPipe): boolean {
		return this._primaryIncomingRequestPipe === pipe;
	}

	public _isPrimaryRequestPipe(pipe: pipes.RequestPipe): boolean {
		return this._primaryRequestPipeHolder.send === pipe;
	}

	public _onClose(): void {
		this.readyState = ReadyState.Closed;
		this.emit("close");
	}

	public _destroy(): void {
		this.id = -1;
		this.readyState = ReadyState.Closed;
		this._isClientMode = null;
		this._session = null;
		this._pushPipes = null;
		this._incomingPushPipes = null;
		this._primaryPushPipe = null;
		this._primaryIncomingPushPipe = null;
		this._requestPipes = null;
		this._incomingRequestPipes = null;
		this._primaryRequestPipeHolder = null;
		this._primaryIncomingRequestPipe = null;
		this._pushPipeIdx = -1;
		this._requestPipeIdx = -1;
	}
}
