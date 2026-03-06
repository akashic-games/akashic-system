import * as lu from "@akashic/log-util";
import * as http from "http";
import * as https from "https";
import * as net from "net";
import * as ws from "ws";
import { Factory } from "./Factory";
import { Server, ServerOption } from "./Server";
import { WSSocket } from "./Socket";

export class WebSocketServer extends Server {
	private _wss: ws.Server;
	private _httpServer: http.Server | https.Server;
	private _onUpgradeBound: (req: http.IncomingMessage, socket: net.Socket) => void;

	constructor(factory: Factory, logger: lu.LogUtil, opts?: ServerOption) {
		super(factory, logger, opts);
		this._wss = null;
		this._httpServer = null;
		this._onUpgradeBound = this._onUpgrade.bind(this);
		if (this._opts.server) {
			this._opts.server.on("upgrade", this._onUpgradeBound);
			this._wss = new ws.Server({ server: this._opts.server });
			this._wss.on("connection", this._onConnection.bind(this));
			this._wss.on("error", this._onError.bind(this));
		}
	}

	public listen(port: number, fn?: () => void): WebSocketServer {
		this._httpServer = http.createServer();
		this._httpServer.on("upgrade", this._onUpgradeBound);
		this._wss = new ws.Server({ server: this._httpServer });
		this._wss.on("connection", (socket, request) => {
			this._onConnection(socket, request);
		});
		this._wss.on("error", this._onError.bind(this));
		this._httpServer.listen(port, fn);
		return this;
	}

	public close(fn?: (...args: any[]) => void): WebSocketServer {
		Object.keys(this._sessions).forEach((uid: string) => {
			this._sessions[uid].close();
		});
		this._sessions = {};
		this._waitingSessions.forEach((s) => {
			s.close();
		});
		this._waitingSessions = [];
		if (this._opts.server) {
			this._opts.server.removeListener("upgrade", this._onUpgradeBound);
		}
		if (this._httpServer) {
			// http.Server は、 close() に callback を渡せるが、 https の場合に渡せない。
			this._httpServer.close();
			this._httpServer = null;
			setImmediate(() => {
				fn();
			});
		} else {
			if (this._wss) {
				this._wss.close();
				this._wss = null;
			}
			// NOTE: uws.Server#close() doesn't support callback.
			setImmediate(fn);
		}
		return this;
	}

	private _onUpgrade(req: http.IncomingMessage, socket: net.Socket): void {
		const uid = this.parseUid(req.url);
		if (uid) {
			if (!this._sessions[uid]) {
				this._logger.info("the connection was rejected because of invalid session id %s", uid);
				// ここで socket.destroy() を行うと、この後の uws 側のリスナで例外が発生してしまう
				// uws.js の実装と同様に、ここでは socket.end() を使って切断する
				// https://github.com/uWebSockets/uWebSockets/blob/f6e0b5f528d6fb671fffb20b7cb27872972ca6ae/nodejs/dist/uws.js#L8
				socket.end("HTTP/1.1 400 Invalid session\r\n\r\n");
			}
		}
	}

	// ws モジュールの WebSocket インターフェースを使いたいけれど、 lib.dom.d.ts にひっぱられて型を解決できない。
	// tslint:disable-next-line:no-any
	private _onConnection(socket: any, request: http.IncomingMessage): void {
		const uid = this.parseUid(request.url);
		if (uid) {
			if (!this.attachRawSocket(uid, socket)) {
				socket.close();
			}
		} else {
			const wsSocket = new WSSocket(socket, request, this._opts.socketOption);
			wsSocket.logger = this._logger;
			this.prepareSession(wsSocket, request);
		}
	}

	private _onError(err: Error): void {
		this.emit("error", err);
	}
}
