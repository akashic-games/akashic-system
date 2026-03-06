import assert from "assert";
import * as events from "events";
import * as ch from "./Channel";
import * as errors from "./Error";
import * as fr from "./Frame";
import * as pipes from "./Pipe";
import { PrimaryHolder } from "./PrimaryHolder";
import * as protocol from "./Protocol";
import { ReadyState } from "./ReadyState";
import * as serializer from "./Serializer";
import { Socket } from "./Socket";
import * as utils from "./utils";

const PRIMARY_PUSH_HEADER = Buffer.from([0x0]);

export class ControlFrameRequest {
	public frame: fr.ControlFrame;
	private _handler: (err: errors.ProtocolError, acceptData?: Buffer) => void;
	constructor(frame: fr.ControlFrame, handler: (err: errors.ProtocolError, acceptData?: Buffer) => void) {
		this.frame = frame;
		this._handler = handler;
	}
	public finish(acceptData?: Buffer): void {
		this._handler(null, acceptData);
	}
	public fail(err: errors.ProtocolError): void {
		this._handler(err);
	}
	public destroy(): void {
		this.frame = null;
		this._handler = null;
	}
}

export class Session extends events.EventEmitter {
	protected _readyState: ReadyState;
	protected _channels: { [id: number]: ch.Channel };
	protected _primaryChannelHolder: PrimaryHolder<ch.Channel>;
	protected _originFlag: number;
	protected _ctrlFrmIdx: number;
	protected _waitingCFRequests: { [id: number]: ControlFrameRequest };
	private _socket: Socket;
	constructor(socket: Socket, originFlag: number) {
		super();
		this._readyState = ReadyState.Closed;
		this._channels = {};
		this._primaryChannelHolder = new PrimaryHolder<ch.Channel>();
		this._originFlag = originFlag;
		this._waitingCFRequests = {};
		this._socket = socket;
		this._socket.recv((data: Buffer) => {
			this._onRecv(data);
		});
	}
	public onControlFrameFromPeer(_: fr.ControlFrame): void {
		throw new errors.PureVirtualError();
	}
	public close(callback?: (err?: errors.ProtocolError) => void): void {
		if (this._readyState !== ReadyState.Open) {
			setTimeout(() => callback(new errors.InvalidStateError("Session is not open. state: " + ReadyState[this._readyState])), 0);
			return;
		}
		this._readyState = ReadyState.Closing;
		const frame = fr.createCloseControlFrame(this._ctrlFrmIdx);
		const req = new ControlFrameRequest(frame, (err: errors.ProtocolError) => {
			if (err && callback) {
				callback(err);
				return;
			}
			this._readyState = ReadyState.Closed;
			if (callback) {
				callback(null);
			}
		});
		this._waitingCFRequests[frame.id] = req;
		this._ctrlFrmIdx += 2;
		this._send(frame);
	}
	public createPipe(
		channelId: number,
		pipeId: number,
		primary: boolean,
		request: boolean,
		label: string,
		callback: (err: errors.ProtocolError, pipeId?: number) => void,
	): void {
		if (this._readyState !== ReadyState.Open) {
			setTimeout(() => callback(new errors.InvalidStateError("Session is not open. state: " + ReadyState[this._readyState])), 0);
			return;
		}
		const frame = fr.createPipeControlFrame(this._ctrlFrmIdx, primary, request, channelId, pipeId, label);
		const req = new ControlFrameRequest(frame, (err: errors.ProtocolError) => {
			if (err) {
				callback(err);
				return;
			}
			callback(null, pipeId);
		});
		this._waitingCFRequests[frame.id] = req;
		this._ctrlFrmIdx += 2;
		this._send(frame);
	}
	public closePipe(channelId: number, pipeId: number, request: boolean, callback: (err: errors.ProtocolError) => void): void {
		if (this._readyState !== ReadyState.Open) {
			setTimeout(() => callback(new errors.InvalidStateError("Session is not open. state: " + ReadyState[this._readyState])), 0);
			return;
		}
		const frame = fr.createClosePipeControlFrame(this._ctrlFrmIdx, channelId, pipeId, request);
		const req = new ControlFrameRequest(frame, callback);
		this._waitingCFRequests[frame.id] = req;
		this._ctrlFrmIdx += 2;
		this._send(frame);
	}
	public onPipeCloseFrame(frame: fr.ClosePipeControlFrame): void {
		const ch = this._channels[frame.channelId];
		assert(ch, "channel is null");
		if (frame.request) {
			ch._closeIncomingRequestPipe(frame.pipeId);
		} else {
			ch._closeIncomingPushPipe(frame.pipeId);
		}
		this._send(fr.createAcceptControlFrame(frame.id));
	}
	public sendPushPipeData(channelId: number, pipeId: number, data: Buffer): void {
		if (this._readyState !== ReadyState.Open) {
			throw new errors.InvalidStateError("Session is not open. state: " + ReadyState[this._readyState]);
		}
		const isPrimaryChannel = this._primaryChannelHolder.send.id === channelId;
		const isPrimaryPipe = this._channels[channelId]._primaryPushPipe.id === pipeId;
		if (isPrimaryChannel && isPrimaryPipe) {
			this._socket.send(Buffer.concat([PRIMARY_PUSH_HEADER, data], data.length + PRIMARY_PUSH_HEADER.length));
			return;
		}
		const frame: fr.DataFrame = {
			identifier: fr.FrameIdentifier.Data,
			primaryChannel: isPrimaryChannel,
			primaryPipe: isPrimaryPipe,
			request: false,
			channelId: isPrimaryChannel ? null : channelId,
			pipeId: isPrimaryPipe ? null : pipeId,
			payload: data,
		};
		this._send(frame);
	}
	public sendIncomingRequestPipeData(channelId: number, pipeId: number, requestId: number, data: Buffer): void {
		if (this._readyState !== ReadyState.Open) {
			throw new errors.InvalidStateError("Session is not open. state: " + ReadyState[this._readyState]);
		}
		const isPrimaryChannel = this._primaryChannelHolder.send.id === channelId;
		const isPrimaryPipe = this._channels[channelId]._primaryIncomingRequestPipe.id === pipeId;
		const frame: fr.DataFrame = {
			identifier: fr.FrameIdentifier.Data,
			primaryChannel: isPrimaryChannel,
			primaryPipe: isPrimaryPipe,
			request: true,
			requestId,
			channelId: isPrimaryChannel ? null : channelId,
			pipeId: isPrimaryPipe ? null : pipeId,
			payload: data,
		};
		this._send(frame);
	}
	public sendRequestPipeData(channelId: number, pipeId: number, requestId: number, data: Buffer): void {
		if (this._readyState !== ReadyState.Open) {
			throw new errors.InvalidStateError("Session is not open. state: " + ReadyState[this._readyState]);
		}
		const isPrimaryChannel = this._primaryChannelHolder.send.id === channelId;
		const isPrimaryPipe = this._channels[channelId]._primaryRequestPipeHolder.send.id === pipeId;
		const frame: fr.DataFrame = {
			identifier: fr.FrameIdentifier.Data,
			primaryChannel: isPrimaryChannel,
			primaryPipe: isPrimaryPipe,
			request: true,
			requestId,
			channelId: isPrimaryChannel ? null : channelId,
			pipeId: isPrimaryPipe ? null : pipeId,
			payload: data,
		};
		this._send(frame);
	}
	public isPrimaryChannel(ch: ch.Channel): boolean {
		// たぶんこれでよいはず
		return this._primaryChannelHolder.recv === this._primaryChannelHolder.send && this._primaryChannelHolder.recv === ch;
	}
	protected _send(frame: fr.Frame): void {
		this._socket.send(serializer.serialize(frame));
	}
	private _onCloseControlFrame(frame: fr.CloseControlFrame): void {
		this._readyState = ReadyState.Closed;
		this.emit("close");
		this._send(fr.createAcceptControlFrame(frame.id));
	}
	private _onControlFrame(frame: fr.ControlFrame): void {
		if (frame.id !== 0 && (frame.id & 0x1) ^ this._originFlag) {
			// self origin frame, thus it's a response to the waiting control frame
			const req = this._waitingCFRequests[frame.id];
			assert(req, "request is null");
			this._waitingCFRequests[frame.id] = null;
			switch (frame.type) {
				case fr.ControlFrameType.Accept:
					req.finish((frame as fr.AcceptControlFrame).data);
					break;
				case fr.ControlFrameType.Deny:
					req.fail(new errors.RequestDeniedError());
					break;
				default:
					throw new errors.InvalidFrameError(`Unknown ControlFrameType: ${frame.type}`);
			}
			req.destroy();
		} else {
			switch (frame.type) {
				case fr.ControlFrameType.ClosePipe:
					this.onPipeCloseFrame(frame as fr.ClosePipeControlFrame);
					break;
				case fr.ControlFrameType.Close:
					this._onCloseControlFrame(frame as fr.ClosePipeControlFrame);
					break;
				default:
					this.onControlFrameFromPeer(frame);
			}
		}
	}
	private _onDataFrame(frame: fr.DataFrame): void {
		if (this._readyState !== ReadyState.Open) {
			return;
		}
		let ch: ch.Channel = null;
		if (frame.primaryChannel) {
			ch = this._primaryChannelHolder.recv;
		} else {
			ch = this._channels[frame.channelId];
		}
		assert(ch, "channel is null");
		if (frame.request) {
			if ((frame.requestId & 0x1) ^ this._originFlag) {
				// response from peer
				let rp: pipes.RequestPipe = null;
				if (frame.primaryPipe) {
					rp = ch._primaryRequestPipeHolder.recv;
				} else {
					rp = ch._requestPipes[frame.pipeId];
				}
				assert(rp, "request pipe is null");
				rp._onResponse(frame.requestId, frame.payload);
			} else {
				// request from peer
				let rp: pipes.IncomingRequestPipe = null;
				if (frame.primaryPipe) {
					rp = ch._primaryIncomingRequestPipe;
				} else {
					rp = ch._incomingRequestPipes[frame.pipeId];
				}
				assert(rp, "incoming request pipe is null");
				rp._onRequest(frame.requestId, frame.payload);
			}
		} else {
			// push pipe
			let pp: pipes.IncomingPushPipe = null;
			if (frame.primaryPipe) {
				pp = ch._primaryIncomingPushPipe;
			} else {
				pp = ch._incomingPushPipes[frame.pipeId];
			}
			assert(pp, "incoming push pipe is null");
			pp._onPush(frame.payload);
		}
	}
	private _onRecv(buf: Buffer): void {
		// Shortcut
		if (buf[0] === 0x0) {
			this._primaryChannelHolder.recv._primaryIncomingPushPipe._onPush(buf.slice(1));
			return;
		}

		const frm = serializer.deserialize(buf);
		if (frm.identifier === fr.FrameIdentifier.Control) {
			this._onControlFrame(frm as fr.ControlFrame);
		} else {
			this._onDataFrame(frm as fr.DataFrame);
		}
	}
}

// emits: error
export class ClientSession extends Session {
	private _chIdx: number;
	constructor(socket: Socket) {
		super(socket, 0x0);
		this._ctrlFrmIdx = 1;
		this._chIdx = 1;
	}
	public onPipeControlFrame(frame: fr.PipeControlFrame): void {
		const channel = this._channels[frame.channelId];
		assert(channel, "channel is null");
		if (frame.request) {
			channel._createIncomingRequestPipe(frame.pipeId, frame.primary, frame.label);
		} else {
			channel._createIncomingPushPipe(frame.pipeId, frame.primary, frame.label);
		}
		this._send(fr.createAcceptControlFrame(frame.id));
	}
	public onControlFrameFromPeer(frame: fr.ControlFrame): void {
		switch (frame.type) {
			case fr.ControlFrameType.Pipe:
				this.onPipeControlFrame(frame as fr.PipeControlFrame);
				break;
			default:
				throw new errors.UnexpectedFrameError(`Session received unexpected control frame (type: ${frame.type}) from the peer.`);
		}
	}
	public open(callback: (err: errors.ProtocolError) => void): void {
		if (this._readyState !== ReadyState.Closed) {
			setTimeout(() => callback(new errors.InvalidStateError("Session is not closed.")), 0);
			return;
		}
		const random = Math.floor(Math.random() * Math.pow(2, 32) - 1);
		const frame = fr.createOpenControlFrame(this._ctrlFrmIdx, random, protocol.PROTOCOL_VERSION, protocol.PROTOCOL_IDENTIFIER);
		const req = new ControlFrameRequest(frame, (err: errors.ProtocolError, accept?: Buffer) => {
			if (err) {
				callback(err);
				return;
			}
			if (this._readyState !== ReadyState.Opening) {
				callback(new errors.InvalidStateError("Session is not opening."));
				return;
			}
			if (random === accept.readUInt32BE(0)) {
				this._readyState = ReadyState.Open;
				callback(null);
			} else {
				callback(new errors.ProtocolError("Failed to handshake with the server."));
			}
		});
		this._waitingCFRequests[frame.id] = req;
		this._send(frame);
		this._readyState = ReadyState.Opening;
		this._ctrlFrmIdx += 2;
	}
	public createChannel(primary: boolean, label: string, callback: (err: errors.ProtocolError, channel?: ch.Channel) => void): void {
		if (this._readyState !== ReadyState.Open) {
			setTimeout(() => callback(new errors.InvalidStateError("Session is not open. state: " + ReadyState[this._readyState])), 0);
			return;
		}
		const frame = fr.createChannelControlFrame(this._ctrlFrmIdx, primary, this._chIdx++, label);
		if (primary) {
			// プライマリ指定されたとき、送信用プライマリチャネルは存在してはならない
			this._primaryChannelHolder.setSend(null);
		}
		const req = new ControlFrameRequest(frame, (err: errors.ProtocolError) => {
			if (err) {
				callback(err);
				return;
			}
			const channel = new ch.Channel(frame.channelId, true, this, label);
			this._channels[channel.id] = channel;
			if (primary) {
				// acceptフレーム受信時に送受信両方更新する
				this._primaryChannelHolder.set(channel, channel);
			} else {
				const chId = utils.detectOpenStatusMinimumId(this._channels);
				// TODO: ここのコード怪しい
				if (!this._primaryChannelHolder.send) {
					this._primaryChannelHolder.setSend(this._channels[chId]);
				}
				if (!this._primaryChannelHolder.recv) {
					this._primaryChannelHolder.setRecv(this._channels[chId]);
				}
			}
			callback(null, channel);
		});
		this._waitingCFRequests[frame.id] = req;
		this._ctrlFrmIdx += 2;
		this._send(frame);
	}
	public closeChannel(ch: ch.Channel, callback?: (error?: errors.ProtocolError) => void): void {
		if (this._readyState !== ReadyState.Open) {
			setTimeout(() => callback(new errors.InvalidStateError("Session is not open. state: " + ReadyState[this._readyState])), 0);
			return;
		}
		assert(this._channels[ch.id] && this._channels[ch.id] === ch, "unknown channel");
		const frame = fr.createCloseChannelControlFrame(this._ctrlFrmIdx, ch.id);
		if (this._primaryChannelHolder.send === ch) {
			this._primaryChannelHolder.setSend(null);
		}
		ch.readyState = ReadyState.Closing;
		const req = new ControlFrameRequest(frame, (err: errors.ProtocolError) => {
			if (err) {
				throw new errors.ProtocolError("failed to close channel");
			} // callbackで通知したほうがよさそう
			ch.readyState = ReadyState.Closed;
			const chId = utils.detectOpenStatusMinimumId(this._channels);
			// TODO: ここのコード怪しい
			if (this._primaryChannelHolder.recv === ch) {
				if (chId) {
					this._primaryChannelHolder.setRecv(this._channels[chId]);
				}
			}
			if (this._primaryChannelHolder.send === null) {
				if (chId) {
					this._primaryChannelHolder.setSend(this._channels[chId]);
				}
			}
			delete this._channels[ch.id];
			ch._onClose();
			// ch._destroy() ?
			if (callback) {
				callback();
			}
		});
		this._waitingCFRequests[frame.id] = req;
		this._ctrlFrmIdx += 2;
		this._send(frame);
	}
}

// emits: error, channel, open
export class ServerSession extends Session {
	constructor(socket: Socket) {
		super(socket, 0x1);
		this._ctrlFrmIdx = 2;
	}
	public onControlFrameFromPeer(frame: fr.ControlFrame): void {
		switch (frame.type) {
			case fr.ControlFrameType.Open:
				this.onOpenControlFrame(frame as fr.OpenControlFrame);
				break;
			case fr.ControlFrameType.Channel:
				this.onChannelControlFrame(frame as fr.ChannelControlFrame);
				break;
			case fr.ControlFrameType.Pipe:
				this.onPipeControlFrame(frame as fr.PipeControlFrame);
				break;
			case fr.ControlFrameType.CloseChannel:
				this.onCloseChannelControlFrame(frame as fr.CloseChannelControlFrame);
				break;
			default:
				throw new errors.ProtocolError(`Unsupported ControlFrame: ${frame.type}`);
		}
	}
	public onOpenControlFrame(frame: fr.OpenControlFrame): void {
		if (frame.protocolIdentifier === protocol.PROTOCOL_IDENTIFIER && frame.protocolVersion === protocol.PROTOCOL_VERSION) {
			const random = Buffer.alloc(4);
			random.writeUInt32BE(frame.random, 0);
			this._send(fr.createAcceptControlFrame(frame.id, random));
			this._readyState = ReadyState.Open;
			this.emit("open");
		} else {
			this._send(fr.createDenyControlFrame(frame.id));
		}
	}
	public onPipeControlFrame(frame: fr.PipeControlFrame): void {
		const channel = this._channels[frame.channelId];
		assert(channel, "channel is null");
		if (frame.request) {
			channel._createIncomingRequestPipe(frame.pipeId, frame.primary, frame.label);
		} else {
			channel._createIncomingPushPipe(frame.pipeId, frame.primary, frame.label);
		}
		this._send(fr.createAcceptControlFrame(frame.id));
	}
	public onChannelControlFrame(frame: fr.ChannelControlFrame): void {
		if (this._channels[frame.channelId]) {
			throw new errors.InvalidStateError(`channel ${frame.channelId} already exists`);
		}
		const channel = new ch.Channel(frame.channelId, false, this, frame.label);
		channel.readyState = ReadyState.Open;
		this._channels[frame.channelId] = channel;
		if (frame.primary) {
			this._primaryChannelHolder.set(channel, channel);
		} else {
			// ServerSessionのchannelのsendとrecvは必ず同じである。
			if (!this._primaryChannelHolder.send) {
				const chId = utils.detectOpenStatusMinimumId(this._channels);
				if (chId === null) {
					// channelが存在しない
					this._primaryChannelHolder.set(null, null);
				} else {
					const p = this._channels[chId];
					this._primaryChannelHolder.set(p, p);
				}
			}
		}
		this._send(fr.createAcceptControlFrame(frame.id));
		this.emit("channel", channel);
	}
	public onCloseChannelControlFrame(frame: fr.CloseChannelControlFrame): void {
		if (!this._channels[frame.channelId]) {
			throw new errors.InvalidStateError(`channel ${frame.channelId} to close does not exist`);
		}
		const channel = this._channels[frame.channelId];
		channel.readyState = ReadyState.Closed;
		if (this._primaryChannelHolder.send === channel) {
			const chId = utils.detectOpenStatusMinimumId(this._channels);
			if (chId === null) {
				// channelが存在しない
				this._primaryChannelHolder.set(null, null);
			} else {
				const p = this._channels[chId];
				this._primaryChannelHolder.set(p, p);
			}
		}
		delete this._channels[channel.id];
		channel._onClose();
		// ch._destroy() ?
		this._send(fr.createAcceptControlFrame(frame.id));
	}
}
