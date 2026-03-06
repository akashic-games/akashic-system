import * as amflow from "@akashic/amflow";
import * as amflowMessage from "@akashic/amflow-message";
import * as amtp from "@akashic/amtplib";
import * as playlog from "@akashic/playlog";
import * as events from "events";
import { AMFlowLike } from "./AMFlowLike";
import Request = amflowMessage.Request;
import Response = amflowMessage.Response;
import Opcode = amflowMessage.Opcode;

export enum ReadyState {
	Open,
	Closing,
	Closed,
}

export interface PushPipes {
	primary: amtp.PushPipe;
	secondary: amtp.PushPipe;
	incomingPrimary: amtp.IncomingPushPipe;
	incomingSecondary: amtp.IncomingPushPipe;
}

export interface AssignedPushPipes {
	sendTick: amtp.PushPipe;
	subscribeTick: amtp.IncomingPushPipe;
	sendEvent: amtp.PushPipe;
	subscribeEvent: amtp.IncomingPushPipe;
}

export class PushPipeHandler {
	private pipes: PushPipes;

	constructor(pipes: PushPipes) {
		this.pipes = pipes;
	}

	public assign(permission: amflow.Permission): AssignedPushPipes {
		const assigned: AssignedPushPipes = {
			sendTick: null,
			subscribeTick: null,
			sendEvent: null,
			subscribeEvent: null,
		};
		if (permission.writeTick) {
			assigned.subscribeTick = this.pipes.incomingPrimary;
		}
		if (permission.sendEvent) {
			if (permission.writeTick) {
				assigned.subscribeEvent = this.pipes.incomingSecondary;
			} else {
				assigned.subscribeEvent = this.pipes.incomingPrimary;
			}
		}
		if (permission.subscribeTick) {
			assigned.sendTick = this.pipes.primary;
		}
		if (permission.subscribeEvent) {
			if (permission.subscribeTick) {
				assigned.sendEvent = this.pipes.secondary;
			} else {
				assigned.sendEvent = this.pipes.primary;
			}
		}
		return assigned;
	}
}

export class Client extends events.EventEmitter {
	public readyState: ReadyState;

	public id: number;
	public amtpChannel: amtp.Channel;

	public playId: string;

	private needsBuffering: boolean;
	private sendBuffer: (() => void)[];

	private incomingRequestPipe: amtp.IncomingRequestPipe;
	private outgoingRequestPipe: amtp.RequestPipe;

	private amflow: AMFlowLike;

	private pushPipes: PushPipes;
	private pushPipeHandler: PushPipeHandler;
	private assignedPushPipes: AssignedPushPipes;

	private onPlaylogTickBound: (tick: Buffer) => void;
	private onPlaylogEventBound: (event: Buffer) => void;

	constructor(id: number, ch: amtp.Channel, amflow: AMFlowLike) {
		super();

		this.readyState = ReadyState.Closed;

		this.needsBuffering = false;
		this.sendBuffer = [];

		this.id = id;
		this.playId = null;
		this.amtpChannel = ch;
		this.incomingRequestPipe = null;
		this.outgoingRequestPipe = null;

		this.pushPipes = {
			primary: null,
			secondary: null,
			incomingPrimary: null,
			incomingSecondary: null,
		};
		this.pushPipeHandler = null;
		this.assignedPushPipes = null;

		this.onPlaylogTickBound = this.onPlaylogTick.bind(this);
		this.onPlaylogEventBound = this.onPlaylogEvent.bind(this);

		this.amflow = amflow;

		this.handleChannel();
	}

	public close(): void {
		// TODO:
		this.readyState = ReadyState.Closed;
		this.unhandleAssignedPushPipes();
		this.clearIncomingPushPipesListeners();
		this.sendBuffer = [];
		this.amflow.close();
	}

	public startBuffering(): void {
		this.needsBuffering = true;
	}

	public stopBufferingAndFlush(): void {
		const buf = this.sendBuffer;
		this.sendBuffer = [];
		buf.forEach((b) => b());
		this.needsBuffering = false;
	}

	private handleChannel(): void {
		this.amtpChannel.on("close", () => {
			if (this.readyState === ReadyState.Open) {
				this.readyState = ReadyState.Closed;
				this.unhandleAssignedPushPipes();
				this.emit("close");
			}
		});
		this.amtpChannel.on("request-pipe", (pipe: amtp.IncomingRequestPipe) => {
			if (this.incomingRequestPipe) {
				throw new Error("incoming request pipe already exists");
			}
			this.incomingRequestPipe = pipe;
			this.handleIncomingRequestPipe();
		});
		this.amtpChannel.on("push-pipe", (pipe: amtp.IncomingPushPipe) => {
			if (pipe.isPrimary()) {
				if (this.pushPipes.incomingPrimary) {
					throw new Error("primary incoming push pipe already exists");
				}
				this.pushPipes.incomingPrimary = pipe;
			} else {
				if (this.pushPipes.incomingSecondary) {
					throw new Error("secondary incoming push pipe already exists");
				}
				this.pushPipes.incomingSecondary = pipe;
			}
			this.emit("new-incoming-push-pipe");
		});
	}

	private handleIncomingRequestPipe(): void {
		this.incomingRequestPipe.on("request", (data, res) => {
			const req = Request.decode(data);
			switch (req.code) {
				case Opcode.Open:
					this.handleOpenRequest(req as Request.OpenRequest, res);
					break;
				case Opcode.Authenticate:
					this.handleAuthenticateRequest(req as Request.AuthenticateRequest, res);
					break;
				case Opcode.GetTickList:
					this.handleGetTickListRequest(req as Request.GetTickListRequest, res);
					break;
				case Opcode.GetStartPoint:
					const getStartPointReq = req as Request.GetStartPointRequest | Request.GetStartPointByTimestampRequest;
					if ("timestamp" in getStartPointReq.opts) {
						this.handleGetStartPointByTimestampRequest(getStartPointReq as Request.GetStartPointByTimestampRequest, res);
					} else {
						this.handleGetStartPointRequest(getStartPointReq as Request.GetStartPointRequest, res);
					}
					break;
				case Opcode.PutStartPoint:
					this.handlePutStartPointRequest(req as Request.PutStartPointRequest, res);
					break;
				case Opcode.GetStorageData:
					this.handleGetStorageDataRequest(req as Request.GetStorageDataRequest, res);
					break;
				case Opcode.PutStorageData:
					this.handlePutStorageDataRequest(req as Request.PutStorageDataRequest, res);
					break;
				case Opcode.Close:
					this.handleCloseRequest(req as Request.CloseRequest, res);
					break;
				default:
					throw new Error("unsupported request " + req.code);
			}
		});
	}

	private handleOpenRequest(req: Request.OpenRequest, res: amtp.RequestPipeResponse): void {
		let resMsg: Response.OpenResponse = null;
		const tasks: Promise<void>[] = [];
		this.playId = req.playId;
		tasks.push(
			new Promise<void>((resolve, reject) => {
				// クライアントからの primary と secondary の push pipe 確立要求を受け付けて、
				// this.pushpipes.incomingPrimary と this.pushPipes.incomingSecondary のセットアップが終わったら resolve
				// タイムアウトで reject
				const timer = setTimeout(() => {
					reject(new Error("timed out for waiting incoming push pipes"));
				}, 5000);
				const checkIncomingPushPipeFn = () => {
					if (!this.pushPipes.incomingPrimary || !this.pushPipes.incomingSecondary) {
						return;
					}
					clearTimeout(timer);
					this.removeListener("new-incoming-push-pipe", checkIncomingPushPipeFn);
					resolve();
				};
				this.on("new-incoming-push-pipe", checkIncomingPushPipeFn);
				checkIncomingPushPipeFn();
			}),
		);
		tasks.push(
			new Promise<void>((resolve, reject) => {
				this.amtpChannel.createPushPipe({ primary: true }, (err: Error, pipe: amtp.PushPipe) => {
					if (err) {
						return reject(err);
					}
					this.pushPipes.primary = pipe;
					resolve();
				});
			}),
		);
		tasks.push(
			new Promise<void>((resolve, reject) => {
				this.amtpChannel.createPushPipe({ primary: false }, (err: Error, pipe: amtp.PushPipe) => {
					if (err) {
						return reject(err);
					}
					this.pushPipes.secondary = pipe;
					resolve();
				});
			}),
		);
		tasks.push(
			new Promise<void>((resolve, reject) => {
				this.amtpChannel.createRequestPipe((err: Error, pipe: amtp.RequestPipe) => {
					if (err) {
						return reject(err);
					}
					this.outgoingRequestPipe = pipe;
					resolve();
				});
			}),
		);
		tasks.push(
			new Promise<void>((resolve, reject) => {
				this.amflow.open(this.playId, (err: Error) => {
					if (err) {
						return reject(err);
					}
					resolve();
				});
			}),
		);
		Promise.all(tasks)
			.then(() => {
				this.pushPipeHandler = new PushPipeHandler(this.pushPipes);
				resMsg = new Response.OpenResponse();
				this.readyState = ReadyState.Open;
				this.emit("open");
				resEnd(res, resMsg);
			})
			.catch(() => {
				resMsg = new Response.OpenResponse({ name: "RuntimeError", message: "failed to open" });
				this.emit("error", new Error("received open request from client, but failed to open"));
				resEnd(res, resMsg);
			});
	}

	private handleCloseRequest(_: Request.CloseRequest, res: amtp.RequestPipeResponse): void {
		this.readyState = ReadyState.Closing;
		let resMsg: Response.CloseResponse = null;
		this.unhandleAssignedPushPipes();
		this.clearIncomingPushPipesListeners();
		const tasks: Promise<void>[] = [];
		tasks.push(
			new Promise<void>((resolve) => {
				if (this.pushPipes.primary) {
					this.pushPipes.primary.close(() => {
						// error ?
						resolve();
					});
				} else {
					resolve();
				}
			}),
		);
		tasks.push(
			new Promise<void>((resolve) => {
				if (this.pushPipes.secondary) {
					this.pushPipes.secondary.close(() => {
						// error ?
						resolve();
					});
				} else {
					resolve();
				}
			}),
		);
		tasks.push(
			new Promise<void>((resolve) => {
				if (this.outgoingRequestPipe) {
					this.outgoingRequestPipe.close(() => {
						resolve();
					});
				} else {
					resolve();
				}
			}),
		);
		tasks.push(
			new Promise<void>((resolve, reject) => {
				this.amflow.close((error) => {
					if (error) {
						return reject();
					}
					resolve();
				});
			}),
		);
		Promise.all(tasks)
			.then(() => {
				resMsg = new Response.CloseResponse();
				resEnd(res, resMsg);
				this.readyState = ReadyState.Closed;
				this.emit("close");
			})
			.catch(() => {
				resMsg = new Response.CloseResponse({ name: "RuntimeError", message: "failed to close" });
				resEnd(res, resMsg);
				this.emit("error", new Error("received close request from client, but failed to close"));
			});
	}

	private handleAuthenticateRequest(req: Request.AuthenticateRequest, res: amtp.RequestPipeResponse): void {
		this.unhandleAssignedPushPipes();
		this.amflow.authenticate(req.token, (err: Error, permission: amflow.Permission) => {
			if (err) {
				const resMsg = new Response.AuthenticateResponse(createRuntimeError("failed to authenticate"));
				resEnd(res, resMsg);
			} else {
				this.assignedPushPipes = this.pushPipeHandler.assign(permission);
				this.handleAssignedPushPipes();
				const resMsg = new Response.AuthenticateResponse(null, permission);
				resEnd(res, resMsg);
			}
		});
	}

	private handleAssignedPushPipes(): void {
		const pipes = this.assignedPushPipes;
		if (pipes.subscribeEvent) {
			pipes.subscribeEvent.on("push", (data) => {
				this.amflow.sendRawEvent(data);
			});
		}
		if (pipes.subscribeTick) {
			pipes.subscribeTick.on("push", (data) => {
				this.amflow.sendRawTick(data);
			});
		}
		if (pipes.sendTick) {
			this.amflow.onRawTick(this.onPlaylogTickBound);
		}
		if (pipes.sendEvent) {
			this.amflow.onRawEvent(this.onPlaylogEventBound);
		}
	}

	private unhandleAssignedPushPipes(): void {
		const pipes = this.assignedPushPipes;
		if (!pipes) {
			return;
		}
		if (pipes.subscribeEvent) {
			pipes.subscribeEvent.removeAllListeners("push");
		}
		if (pipes.subscribeTick) {
			pipes.subscribeTick.removeAllListeners("push");
		}
		if (pipes.sendTick) {
			this.amflow.offRawTick(this.onPlaylogTickBound);
		}
		if (pipes.sendEvent) {
			this.amflow.offRawEvent(this.onPlaylogEventBound);
		}
	}

	private clearIncomingPushPipesListeners(): void {
		if (!this.pushPipes) {
			return;
		}
		if (this.pushPipes.incomingPrimary) {
			this.pushPipes.incomingPrimary.removeAllListeners();
		}
		if (this.pushPipes.incomingSecondary) {
			this.pushPipes.incomingSecondary.removeAllListeners();
		}
	}

	private handleGetTickListRequest(req: Request.GetTickListRequest, res: amtp.RequestPipeResponse): void {
		// 高速化のために正常系ではエンコード結果を直接作る(createEncodedDirect())ので、他と異なりresEnd()を使わない点に注意
		this.amflow.getRawTickList(
			req.start,
			req.end,
			(err: Error, tickList: Buffer[]) => {
				let encodedResMsg: Buffer;
				if (err) {
					encodedResMsg = Response.encode(new Response.GetTickListResponse(err));
				} else {
					encodedResMsg = Response.GetTickListResponse.createEncodedDirect(tickList);
				}
				if (this.needsBuffering) {
					this.sendBuffer.push(() => {
						res.end(encodedResMsg);
					});
				} else {
					if (this.readyState === ReadyState.Open) {
						res.end(encodedResMsg);
					}
				}
			},
			req.excludeEventFlags,
		);
	}

	private handleGetStartPointRequest(req: Request.GetStartPointRequest, res: amtp.RequestPipeResponse): void {
		this.amflow.getStartPoint(req.opts, (err: Error, startPoint: amflow.StartPoint) => {
			const resMsg = new Response.GetStartPointResponse(err, startPoint);
			if (this.needsBuffering) {
				this.sendBuffer.push(() => {
					resEnd(res, resMsg);
				});
			} else {
				if (this.readyState === ReadyState.Open) {
					resEnd(res, resMsg);
				}
			}
		});
	}

	private handleGetStartPointByTimestampRequest(req: Request.GetStartPointByTimestampRequest, res: amtp.RequestPipeResponse): void {
		this.amflow.getStartPoint(req.opts, (err: Error, startPoint: amflow.StartPoint) => {
			const resMsg = new Response.GetStartPointResponse(err, startPoint);
			if (this.needsBuffering) {
				this.sendBuffer.push(() => {
					resEnd(res, resMsg);
				});
			} else {
				if (this.readyState === ReadyState.Open) {
					resEnd(res, resMsg);
				}
			}
		});
	}

	private handlePutStartPointRequest(req: Request.PutStartPointRequest, res: amtp.RequestPipeResponse): void {
		const startPoint: amflow.StartPoint = req.startPoint;
		this.amflow.putStartPoint(startPoint, (err: Error) => {
			const resMsg = new Response.PutStartPointResponse(err);
			if (this.needsBuffering) {
				this.sendBuffer.push(() => {
					resEnd(res, resMsg);
				});
			} else {
				if (this.readyState === ReadyState.Open) {
					resEnd(res, resMsg);
				}
			}
		});
	}

	private handleGetStorageDataRequest(req: Request.GetStorageDataRequest, res: amtp.RequestPipeResponse): void {
		this.amflow.getStorageData(req.keys, (err: Error, values: playlog.StorageData[]) => {
			const resMsg = new Response.GetStorageDataResponse(err, values);
			if (this.needsBuffering) {
				this.sendBuffer.push(() => {
					resEnd(res, resMsg);
				});
			} else {
				if (this.readyState === ReadyState.Open) {
					resEnd(res, resMsg);
				}
			}
		});
	}

	private handlePutStorageDataRequest(req: Request.PutStorageDataRequest, res: amtp.RequestPipeResponse): void {
		this.amflow.putStorageData(req.key, req.value, req.opts, (err: Error) => {
			const resMsg = new Response.PutStorageDataResponse(err);
			if (this.needsBuffering) {
				this.sendBuffer.push(() => {
					resEnd(res, resMsg);
				});
			} else {
				if (this.readyState === ReadyState.Open) {
					resEnd(res, resMsg);
				}
			}
		});
	}

	private onPlaylogTick(tick: Buffer): void {
		if (this.assignedPushPipes.sendTick) {
			if (this.needsBuffering) {
				this.sendBuffer.push(() => {
					this.assignedPushPipes.sendTick.push(tick);
				});
			} else {
				this.assignedPushPipes.sendTick.push(tick);
			}
		}
	}

	private onPlaylogEvent(event: Buffer): void {
		if (this.assignedPushPipes.sendEvent) {
			if (this.needsBuffering) {
				this.sendBuffer.push(() => {
					this.assignedPushPipes.sendEvent.push(event);
				});
			} else {
				this.assignedPushPipes.sendEvent.push(event);
			}
		}
	}

	/**
	 * @event Client#error
	 * @type {Error} err
	 */
	/**
	 * @event Client#close
	 */
}

function createRuntimeError(message: string): Response.ResponseError {
	return { name: "Runtime", message };
}

// function createPermissionError(message: string): Response.ResponseError {
// 	return {name: "Permission", message: message};
// }
//
// function createTokenRevokedError(): Response.ResponseError {
// 	return {name: "TokenRevoked", message: "authenticated token revoked"};
// }

function resEnd(res: amtp.RequestPipeResponse, msg: amflowMessage.Message): void {
	res.end(Response.encode(msg));
}
