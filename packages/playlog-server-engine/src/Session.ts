import * as amtp from "@akashic/amtplib";
import * as lu from "@akashic/log-util";
import * as events from "events";
import * as http from "http";
import { Client } from "./Client";
import { Factory } from "./Factory";
import * as SessionControlMessage from "./SessionControlMessage";
import { Socket } from "./Socket";

/**
 * ひとつの HTTP UPGRADE リクエストから生える、Web Socket セッション
 */
export class Session extends events.EventEmitter {
	get upgradeRequest(): http.IncomingMessage {
		return this._upgradeRequest;
	}

	set upgradeRequest(upgradeReq: http.IncomingMessage) {
		if (this._upgradeRequest) {
			throw new Error("You can set upgradeRequest only once.");
		}
		this._upgradeRequest = upgradeReq;
	}

	public static create(
		socket: Socket,
		factory: Factory,
		logger: lu.LogUtil,
		refuseClient: boolean,
		upgradeRequest: http.IncomingMessage,
	): Session {
		const instance = new Session(socket, factory, logger, refuseClient);
		instance.upgradeRequest = upgradeRequest;
		return instance;
	}
	public id: string;
	public socket: Socket;
	public refuseClient: boolean;
	private amtpServerSession: amtp.Server;
	private clients: { [id: string]: Client };
	private clientIdx: number;
	private factory: Factory;
	private logger: lu.LogUtil;
	private controlPushPipe: amtp.PushPipe;

	private _upgradeRequest: http.IncomingMessage;

	/**
	 * onConnect でインスタンス生成される必要がある。
	 *
	 * @param socket
	 * @param factory
	 * @param logger
	 * @param refuseClient
	 */
	constructor(socket: Socket, factory: Factory, logger: lu.LogUtil, refuseClient: boolean) {
		super();
		this.id = null;
		this.socket = socket;
		this.amtpServerSession = new amtp.Server(this.socket);
		this.factory = factory;
		this.logger = logger;
		this.clients = {};
		this.clientIdx = 1;
		this.refuseClient = refuseClient;
		this.controlPushPipe = null;

		this.socket.on("close", () => {
			this.onSocketClose();
		});
		this.socket.on("timeout", () => {
			this.onSocketClose();
		});
		this.socket.on("error", (err) => {
			this.logger.warn("[session:%s] detect error on underlying socket.", this.id, err);
			this.onSocketClose();
		});
		this.socket.on("disconnected", () => {
			this.onSocketDisconnected();
		});
		this.socket.on("attached", () => {
			this.onSocketAttached();
		});
		this.amtpServerSession.on("close", () => {
			this.onAMTPClose();
		});
		this.handleChannel();
	}

	public handleChannel(): void {
		this.amtpServerSession.on("channel", (ch: amtp.Channel) => {
			if (ch.label === "session_control") {
				this.handleSessionControlChannel(ch);
				return;
			}
			if (this.id == null) {
				return;
			}
			if (ch.label !== "playlog") {
				this.emit("channel", ch);
				return;
			}
			if (this.refuseClient) {
				this.logger.warn("[session:%s] the session refused to create new client.", this.id);
				this.emit("refuse");
				return;
			}
			const c = new Client(this.clientIdx, ch, this.factory.createAMFlow(this));
			c.on("error", (err) => {
				this.logger.warn("[session:%s] the client occurs an error. clientId:%d", this.id, c.id, err);
			});
			c.on("close", () => {
				this.logger.info("[session:%s] the client was closed. playId:%s, clientId:%d", this.id, c.playId, c.id);
				delete this.clients[c.id];
			});
			c.on("open", () => {
				this.logger.info("[session:%s] the client was open. playId:%s, clientId:%d", this.id, c.playId, c.id);
			});
			this.clients[this.clientIdx] = c;
			this.logger.info(
				"[session:%s] a new client is ready. amtpChannelId:%d, clientId:%d, total:%d",
				this.id,
				ch.id,
				this.clientIdx,
				Object.keys(this.clients).length,
			);
			this.clientIdx++;
			this.emit("client", c);
		});
	}

	public handleSessionControlChannel(ch: amtp.Channel): void {
		// 1. クライアントが先にリクエストパイプを作る
		// 2. サーバがプッシュパイプを開く
		ch.on("request-pipe", (pipe: amtp.IncomingRequestPipe) => {
			pipe.on("request", (data, res) => {
				const requestMessage = SessionControlMessage.toRequestMessage(data);
				if (!requestMessage) {
					return;
				}
				switch (requestMessage.code) {
					case SessionControlMessage.ControlCode.Establish:
						this.handleEstablishRequest(requestMessage as SessionControlMessage.EstablishRequestMessage, res);
						return;
					case SessionControlMessage.ControlCode.Validate:
						this.handleValidationRequest(requestMessage as SessionControlMessage.ValidateRequestMessage, res);
						return;
					default:
						this.logger.warn("[session:%s] unknown session control message recieved. code: ", this.id, requestMessage.code);
				}
			});
			ch.createPushPipe((error, pipe) => {
				if (error) {
					this.logger.warn("[session:%s] failed to create push pipe for session control", this.id);
					return;
				}
				this.controlPushPipe = pipe;
			});
		});
	}

	public sendSessionControlMessage(data: Buffer): void {
		this.controlPushPipe.push(data);
	}

	public close(): void {
		this.socket.close();
	}

	private handleEstablishRequest(_: SessionControlMessage.EstablishRequestMessage, res: amtp.RequestPipeResponse): void {
		this.emit("establish-request", (uid: string) => {
			if (uid) {
				this.id = uid;
				res.end(new SessionControlMessage.EstablishResponseMessage(uid).toBytes());
			} else {
				this.close();
			}
		});
	}

	private handleValidationRequest(requestMessage: SessionControlMessage.ValidateRequestMessage, res: amtp.RequestPipeResponse): void {
		this.emit("validation-request", requestMessage.playId, requestMessage.token, (ok: boolean) => {
			res.end(new SessionControlMessage.ValidateResponseMessage(ok).toBytes());
		});
	}

	private onAMTPClose(): void {
		this.socket.close();
	}

	private onSocketDisconnected(): void {
		Object.keys(this.clients).forEach((id) => this.clients[id].startBuffering());
	}

	private onSocketAttached(): void {
		Object.keys(this.clients).forEach((id) => this.clients[id].stopBufferingAndFlush());
	}

	private onSocketClose(): void {
		this.closeClients();
		this.emit("close");
	}

	private closeClients(): void {
		Object.keys(this.clients).forEach((id) => {
			this.clients[id].close();
			delete this.clients[id];
		});
	}
}
