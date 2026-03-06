import * as lu from "@akashic/log-util";
import * as events from "events";
import * as http from "http";
import * as https from "https";
import * as uuid from "node-uuid";
import * as querystring from "querystring";
import { parse } from "url";
import { Factory } from "./Factory";
import { Session } from "./Session";
import { Option, Socket } from "./Socket";

export interface ServerOption {
	server?: http.Server | https.Server;
	socketOption?: Option;
	sessionRefuseClient?: boolean;
}

export abstract class Server extends events.EventEmitter {
	protected _sessions: { [s: string]: Session } = {};
	protected _waitingSessions: Session[];
	protected _opts: ServerOption;
	protected _factory: Factory;
	protected _logger: lu.LogUtil;

	constructor(factory: Factory, logger: lu.LogUtil, opts?: ServerOption) {
		super();
		this._sessions = {};
		this._opts = opts || {};
		this._factory = factory;
		this._logger = logger;
		this._waitingSessions = [];
	}

	public abstract listen(port: number, fn?: Function): Server;

	public abstract close(fn?: Function): Server;

	protected attachRawSocket(id: string, rawSocket: any): boolean {
		if (id) {
			if (this._sessions[id]) {
				this._logger.info("the session %s re-established", id);
				this._sessions[id].socket.attach(rawSocket);
				return true;
			} else {
				this._logger.info("the connection was rejected because of invalid session id %s", id);
				return false;
			}
		}
	}

	protected prepareSession(socket: Socket, upgradeRequest: http.IncomingMessage): void {
		const s = Session.create(socket, this._factory, this._logger, !!this._opts.sessionRefuseClient, upgradeRequest);
		this._waitingSessions.push(s);
		s.on("close", () => {
			s.removeAllListeners();
			delete this._sessions[s.id];
			const idx = this._waitingSessions.indexOf(s);
			if (idx !== -1) {
				this._waitingSessions.splice(idx, 1);
			}
			this._logger.info("the session %s was closed. total:%d", s.id, Object.keys(this._sessions).length);
		});
		s.on("establish-request", (callback: (uid: string) => void) => {
			this._waitingSessions = this._waitingSessions.filter((v) => v !== s);
			const uid: string = uuid.v4();
			callback(uid);
			this._sessions[uid] = s;
			this._logger.info("a new session %s is established. total:%d", s.id, Object.keys(this._sessions).length);
			this.emit("session", s);
		});
	}

	protected parseUid(url: string): string {
		const query = parse(url).query;
		return querystring.parse(query || "").uid as string;
	}

	/**
	 * @event Server#session
	 * @type {Session} session
	 */

	/**
	 * @event Server#error
	 * @type {Error} err
	 */
}
