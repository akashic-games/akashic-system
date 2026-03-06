import { LogUtil } from "@akashic/log-util";
import { Server, Session } from "@akashic/playlog-server-engine";
import { PlayToken, PlayTokenPermissionLike } from "@akashic/server-engine-data-types";
import * as Cookie from "cookie";
import * as events from "events";
import moment from "moment";
import { performance } from "perf_hooks";
import { PlayTokenValidator } from "./PlayTokenValidator";
import { userSessionParser } from "./userSessionValidator";

export interface SessionInfo {
	// セッションの ID
	id: string;
	// セッション開始時刻
	startedAt: string;
	// dispatch された playId
	dispatchedPlayId: string;
	// HTTP リクエストヘッダから取得された userId
	sessionUserId?: string;
	// user agent 情報
	userAgent?: string;
	// このセッションで認証された play 情報
	authorizedPlays?: {
		// 認証時刻
		validatedAt: string;
		// playId
		playId: string;
		// play token の userId
		userId?: string;
		// play token の permission
		permission: PlayTokenPermissionLike;
	}[];
}

// イベント
// timeout: 予約がタイムアウトした
// start: 予約していたセッションが開始した
// end: 開始していたセッションが終了した
// limit: 予約していたがセッション最大数に引っ掛かってセッションは開始されなかった
// deny: 予約されていないセッションを開始しようとした
export class SessionManager extends events.EventEmitter {
	private _server: Server;
	private _reserved: { [playId: string]: { [token: string]: ReturnType<typeof setTimeout> } };
	private _started: Map<string, SessionInfo>;
	private _limit: number;
	private _reservationExpire: number;
	private _playTokenValidator: PlayTokenValidator;
	private _logger: LogUtil;
	constructor(limit: number, reservationExpire: number, playTokenValidator: PlayTokenValidator, logger: LogUtil) {
		super();
		this._server = null;
		this._reserved = {};
		this._started = new Map();
		this._limit = limit;
		this._reservationExpire = reservationExpire;
		this._playTokenValidator = playTokenValidator;
		this._logger = logger;

		this._playTokenValidator.on("validated", (session: Session, playId: string, token: PlayToken) => {
			this._onTokenValidated(session, playId, token);
		});
	}
	public reserve(playId: string, tokenValue: string): void {
		const startTime = performance.now();
		if (!this._reserved[playId]) {
			this._reserved[playId] = {};
		}
		this._reserved[playId][tokenValue] = setTimeout(async () => {
			this.emit("timeout", playId);
			this._deleteReservation(playId, tokenValue);
			let userId = "-";
			let permission = {};
			const token = await this._playTokenValidator.peekToken(playId, tokenValue);
			if (token != null) {
				userId = token.meta != null && token.meta.userId != null ? token.meta.userId : "-";
				permission = token.permission || {};
			}
			// 大量のログが出てパフォーマンス低下と、結果的なセグメンテーション違反の要因の一つになっている疑いがあるためコメントアウト
			// this._logger.warn("session reservation timeout: playId: %s, token userId: %s, token permission: %j", playId, userId, permission);
		}, this._reservationExpire);
		const reservedSessionTimeoutFuncSetTime = performance.now() - startTime;
		if (reservedSessionTimeoutFuncSetTime > 1000) {
			this._logger.warn(`reserved session timeout func set time: ${reservedSessionTimeoutFuncSetTime} ms. playId: ${playId}`);
		}

		this.emit("reserve", playId);
		const reservedSessionEmitTime = performance.now() - startTime;
		if (reservedSessionEmitTime > 1000) {
			this._logger.warn(`reserved session emit time: ${reservedSessionEmitTime} ms. playId: ${playId}`);
		}
	}
	public attachServer(server: Server): void {
		this._server = server;
		this._handleServer();
	}
	public count(playId?: string): number {
		if (playId == null) {
			return this._started.size;
		} else {
			let count = 0;
			this._started.forEach((target) => {
				if (target.dispatchedPlayId === playId) {
					count++;
				}
			});
			return count;
		}
	}
	public capacity(): number {
		return this._limit - this._started.size;
	}
	public sessions(): SessionInfo[] {
		return Array.from(this._started.values());
	}

	private _deleteReservation(playId: string, token: string): void {
		if (!this._reserved[playId]) {
			return;
		}
		delete this._reserved[playId][token];
		if (Object.keys(this._reserved[playId]).length === 0) {
			delete this._reserved[playId];
		}
	}
	private _endBySession(session: Session): void {
		const sessionInfo = this._started.get(session.id);
		if (sessionInfo == null) {
			return;
		}
		this._started.delete(session.id);
		this.emit("end", sessionInfo.dispatchedPlayId);
	}
	private _start(playId: string, token: string, sessionId: string, userId: string, userAgent: string): boolean {
		if (!this._reserved[playId] || !this._reserved[playId][token]) {
			this.emit("deny", playId);
			return false;
		}
		clearTimeout(this._reserved[playId][token]);
		this._deleteReservation(playId, token);
		if (this._started.size >= this._limit) {
			this.emit("limit", playId);
			return false;
		}
		this._started.set(sessionId, {
			id: sessionId,
			startedAt: moment().format(),
			dispatchedPlayId: playId,
			sessionUserId: userId,
			userAgent,
		});
		this.emit("start", playId);
		return true;
	}
	private _handleServer(): void {
		this._server.on("session", (session: Session) => {
			const headers = session.upgradeRequest.headers;
			let userId: string | undefined;
			if (typeof headers.cookie === "string") {
				const cookie = Cookie.parse(headers.cookie);
				if (typeof cookie.user_session === "string") {
					userId = userSessionParser(cookie.user_session).userId;
				}
			}
			let userAgent: string | undefined;
			const userAgentHeader = headers["user-agent"];
			if (typeof userAgentHeader === "string") {
				userAgent = userAgentHeader;
			}

			// セッション（コネクション）生成後、一定時間以内にバリデーション用データが届かなければ強制closeする。
			const timer = setTimeout(() => {
				this._logger.warn(`validation request timeout: sessionId: ${session.id}, userId: ${userId}, userAgent: ${userAgent}`);
				session.close();
			}, 10 * 1000);

			session.on("validation-request", (playId: string, token: string, callback: (ok: boolean) => void) => {
				if (playId && token) {
					clearTimeout(timer);
					if (this._start(playId, token, session.id, userId, userAgent)) {
						// バリデーションが成功したのでcloseをハンドリングする
						session.once("close", () => {
							this._endBySession(session);
						});
						session.refuseClient = false;
						callback(true);
					} else {
						callback(false);
						// バリデーションが失敗したので一定時間以内にクライアントがcloseすることを期待する。しない場合は強制的にcloseする。
						let closeTimer: ReturnType<typeof setTimeout> | null = null;
						const onClose = () => {
							clearTimeout(closeTimer);
						};
						session.once("close", onClose);
						closeTimer = setTimeout(() => {
							this._logger.warn(
								"force close session by validation failure: " +
									`sessionId: ${session.id}, playId: ${playId}, userId: ${userId}, userAgent: ${userAgent}`,
							);
							// onCloseが呼ばれないようにする
							session.removeListener("close", onClose);
							session.close();
						}, 10 * 1000);
					}
				} else {
					callback(false);
				}
			});
		});
	}

	private _onTokenValidated(session: Session, playId: string, token: PlayToken): void {
		const sessionInfo = this._started.get(session.id);
		if (sessionInfo == null) {
			this._logger.warn(`detect token validation on unknown session: sessionId: ${session.id}, playId: ${playId}`);
			return;
		}
		if (sessionInfo.authorizedPlays == null) {
			sessionInfo.authorizedPlays = [];
		}
		sessionInfo.authorizedPlays.push({
			validatedAt: moment().format(),
			playId,
			userId: token.meta != null ? token.meta.userId : undefined,
			permission: token.permission,
		});
	}
}
