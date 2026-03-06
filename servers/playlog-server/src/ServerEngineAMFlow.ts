import * as amflow from "@akashic/amflow";
import * as amflowMessage from "@akashic/amflow-message";
import * as lu from "@akashic/log-util";
import * as playlog from "@akashic/playlog";
import * as engine from "@akashic/playlog-server-engine";
import * as dt from "@akashic/server-engine-data-types";
import { ExcludeEventFlags } from "@akashic/akashic-system";

import { EventLimitCount } from "./EventLimitCount";
import { Handlers } from "./Handlers";
import { PlayTokenHolder } from "./PlayTokenHolder";

export class ServerEngineAMFlow implements engine.AMFlowLike {
	/**
	 * @type {[EventCode,EventCode,EventCode,EventCode,EventCode]}
	 */
	private static eventCodeWhiteList = [
		playlog.EventCode.Message,
		playlog.EventCode.PointDown,
		playlog.EventCode.PointMove,
		playlog.EventCode.PointUp,
		playlog.EventCode.Operation,
		playlog.EventCode.PlayerInfo,
	];

	private playId: string;

	private _handlers: Handlers;
	private _logger: lu.LogUtil;

	private _tokenHolder: PlayTokenHolder;
	private _gameCode: string;

	private _onBinaryTickBound: (tick: Buffer) => void;
	private _onBinaryEventBound: (event: Buffer) => void;
	private _onPlayTokenRevokeBound: () => void;

	private _permission: amflow.Permission;

	private _writeLocked: boolean;

	private _isMainPlayer: boolean;
	private _eventLimitCount: EventLimitCount;
	private _sendEventCount: number;
	private _beforeTime: number;

	private _playlogHandlerPrepared: boolean;

	private _session: engine.Session;

	private _beforeLogTime: number;

	private _eventHandlers: ((event: Buffer) => void)[];
	private _tickHandlers: ((tick: Buffer) => void)[];

	constructor(handlers: Handlers, logger: lu.LogUtil, eventLimitCount: EventLimitCount, session: engine.Session) {
		this.playId = null;
		this._handlers = handlers;
		this._logger = logger;
		this._tokenHolder = null;
		this._onBinaryTickBound = this._onBinaryTick.bind(this);
		this._onBinaryEventBound = this._onBinaryEvent.bind(this);
		this._onPlayTokenRevokeBound = this._onPlayTokenRevoke.bind(this);

		this._writeLocked = false;

		this._isMainPlayer = false;
		this._eventLimitCount = eventLimitCount;
		this._sendEventCount = 0;
		this._beforeTime = 0;
		this._playlogHandlerPrepared = false;

		this._session = session;

		this._beforeLogTime = 0;

		this._eventHandlers = [];
		this._tickHandlers = [];

		this.initPermission();
	}

	public open(playId: string, callback?: (error?: Error) => void): void {
		this.playId = playId;
		this._handlers.request.ref(playId);
		if (callback) {
			setImmediate(() => {
				callback();
			});
		}
	}

	public close(callback?: (error?: Error) => void): void {
		this._eventHandlers = [];
		this._tickHandlers = [];
		if (this._tokenHolder) {
			this._tokenHolder.removeListener("revoke", this._onPlayTokenRevokeBound);
		}
		if (this._playlogHandlerPrepared) {
			this._handlers.playlog.close(this.playId, this).then(() => {
				this._handlers.request.unref(this.playId); // TickCacheを共有しているので、playlogHandlerをcloseした後にunref
				if (callback) {
					callback();
				}
			});
		} else {
			this._handlers.request.unref(this.playId);
			if (callback) {
				setImmediate(() => {
					callback();
				});
			}
		}
	}

	public authenticate(token: string, callback: (error: Error, permission?: amflow.Permission) => void): void {
		this.initPermission();

		if (this._tokenHolder) {
			this._tokenHolder.removeListener("revoke", this._onPlayTokenRevokeBound);
			this._tokenHolder = null;
		}

		let task: Promise<void> = null;
		if (this._playlogHandlerPrepared) {
			task = this._handlers.playlog.close(this.playId, this).then(() => {
				this._playlogHandlerPrepared = false;
			});
		} else {
			task = Promise.resolve<void>(null);
		}

		task
			.then(() => {
				return this._handlers.playTokenValidator.validate(this._session, this.playId, token);
			})
			.then((tokenHolder) => {
				this._tokenHolder = tokenHolder;
				tokenHolder.on("revoke", this._onPlayTokenRevokeBound);
				const playToken = tokenHolder.playToken;
				const permission: amflow.Permission = {
					writeTick: playToken.permission.writeTick,
					readTick: playToken.permission.readTick,
					sendEvent: playToken.permission.sendEvent,
					subscribeEvent: playToken.permission.subscribeEvent,
					subscribeTick: playToken.permission.subscribeTick,
					maxEventPriority: playToken.permission.maxEventPriority,
				};
				if (playToken.permission.sendEvent && playToken.permission.maxEventPriority === 2) {
					this._isMainPlayer = true;
				}
				this._permission = permission;

				const tasks: Promise<any>[] = [];
				// readTick 以外の permission に対応する操作を行うには amqp 接続が必要
				// readTick のみの場合は、amqp 接続は必要ない
				if (permission.writeTick || permission.sendEvent || permission.subscribeEvent || permission.subscribeTick) {
					tasks.push(
						this._handlers.playlog.prepare(this.playId, this).then(() => {
							this._playlogHandlerPrepared = true;
						}),
					);
				}
				if (permission.writeTick) {
					tasks.push(
						this._handlers.playlog
							.acquireWriteLock(this.playId, () => {
								this._writeLocked = false;
							})
							.then(() => {
								this._writeLocked = true;
							}),
					);
				}
				return Promise.all(tasks).then(() => tokenHolder);
			})
			.then((tokenHolder) => {
				callback(null, this._permission);
			})
			.catch(() => {
				callback(createRuntimeError("failed to authenticate"), null);
			});
	}
	public sendRawTick(tick: Buffer): void {
		if (!this._permission.writeTick) {
			return;
		}
		if (this._tokenHolder && this._tokenHolder.revoked) {
			this.logInSecond(() => {
				this._logger.warn(
					"the tick would have been published was dropped because of revoked token. playId: %s, userId: %s",
					this.playId,
					this._tokenHolder.playToken.meta.userId,
				);
			});
			return;
		}
		if (!this._writeLocked) {
			return;
		}
		this._handlers.playlog.publishTickRaw(this.playId, tick);
	}
	public sendTick(tick: playlog.Tick): void {
		throw createNotImplementedError("ServerEngineAMFlow doesn't implement sendTick(). Use sendRawTick() instead.");
	}
	public onTick(handler: (tick: playlog.Tick) => void): void {
		throw createNotImplementedError("ServerEngineAMFlow doesn't implement onTick(). Use onRawTick() instead.");
	}
	public offTick(handler: (tick: playlog.Tick) => void): void {
		throw createNotImplementedError("ServerEngineAMFlow doesn't implement offTick(). Use offRawTick() instead.");
	}
	public onRawTick(handler: (tick: Buffer) => void): void {
		if (!this._permission.subscribeTick) {
			return;
		}
		if (!this._tickHandlers.length) {
			this._handlers.playlog
				.consumeTick(this.playId, this._onBinaryTickBound)
				.then(() => {
					// nothing to do
				})
				.catch((e) => {
					if (!this._tickHandlers.length) {
						// consumeが完了する前にcancelされた場合、エラーが発生するのでここで成功扱いにする
						return Promise.resolve();
					} else {
						return Promise.reject(createRuntimeError("failed to consume ticks."));
					}
				});
		}
		this._tickHandlers.push(handler);
	}
	public offRawTick(handler: (tick: Buffer) => void): void {
		if (!this._permission.subscribeTick) {
			return;
		}
		this._tickHandlers = this._tickHandlers.filter((h) => {
			return h !== handler;
		});
		if (!this._tickHandlers.length) {
			Promise.resolve(this._handlers.playlog.offConsumeTick(this.playId, this._onBinaryTickBound)).catch((err) =>
				this._logger.error("ServerEngineAMFlow#offRawTick内のoffConsumeTickでエラー", err),
			);
		}
	}
	public sendEvent(event: playlog.Event): void {
		throw createNotImplementedError("ServerEngineAMFlow doesn't implement sendEvent(). Use sendRawEvent() instead.");
	}
	public onEvent(handler: (event: playlog.Event) => void): void {
		throw createNotImplementedError("ServerEngineAMFlow doesn't implement onEvent(). Use onRawEvent() instead.");
	}
	public offEvent(handler: (event: playlog.Event) => void): void {
		throw createNotImplementedError("ServerEngineAMFlow doesn't implement onEventRaw(). Use offRawEvent() instead.");
	}

	public sendRawEvent(buf: Buffer): void {
		if (!this._permission.sendEvent) {
			return;
		}
		if (this._tokenHolder && this._tokenHolder.revoked) {
			this.logInSecond(() => {
				// TODO: 状況によってはログの大量出力の可能性あり(可能性低)
				this._logger.warn(
					"the event was dropped because of revoked token. playId: %s, userId: %s",
					this.playId,
					this._tokenHolder.playToken.meta.userId,
				);
			});
			return;
		}

		// validate event
		let event: playlog.Event;
		try {
			event = amflowMessage.decodeEvent(buf);
		} catch (err) {
			// TODO: 状況によってはログの大量出力の可能性あり(可能性低)
			this._logger.warn("can't decode as playlog event.");
			return;
		}
		if (!Array.isArray(event)) {
			// TODO: 状況によってはログの大量出力の可能性あり(可能性低)
			this._logger.warn("event is not playlog event: " + event);
			return;
		}

		const tokenMeta: dt.PlayTokenMetaLike = this._tokenHolder.playToken.meta;
		if (tokenMeta && tokenMeta.userId) {
			if (!event[2]) {
				event[2] = tokenMeta.userId;
			} else if (event[2] !== tokenMeta.userId) {
				// TODO: 状況によってはログの大量出力の可能性あり(可能性低)
				this._logger.warn(
					"the event was dropped by userId mismatch. playId: %s, authUserId: %s, mismatchUserId: %s, dropEvent: %d",
					this.playId,
					tokenMeta.userId,
					event[2],
					event[0],
				);
				return;
			}
		}
		if (event[1] == null || event[1] > this._permission.maxEventPriority) {
			event[1] = this._permission.maxEventPriority; // プライオリティを上書きする
		}

		// Leave や Join は、playlog-api-server 経由のみなので、playlog-server を経由するものは不正なアクセス
		if (ServerEngineAMFlow.eventCodeWhiteList.indexOf(event[0]) === -1) {
			// TODO: 状況によってはログの大量出力の可能性あり(可能性低)
			this._logger.warn("%d is not allowed event code.", event[0]);
			return;
		}

		const now = Date.now();
		if (now - this._beforeTime > 1000) {
			this._sendEventCount = 0;
			this._beforeTime = now;
		}

		const limit: number = this._isMainPlayer ? this._eventLimitCount.mainPlayer : this._eventLimitCount.subPlayer;
		if (event[1] < 3 && this._sendEventCount >= limit) {
			const userId = tokenMeta && tokenMeta.userId ? tokenMeta.userId : undefined;
			// TODO: 状況によってはログの大量出力の可能性あり(可能性高)
			// 大量のログが出てパフォーマンス低下と、結果的なセグメンテーション違反の要因の一つになっている疑いがあるためコメントアウト
			// this._logger.warn("the event was dropped by limit. playId: %s, userId: %s, eventPriority: %d", this.playId, userId, event[1]);
			return;
		}

		this._handlers.playlog.publishEvent(this.playId, event);
		this._sendEventCount++;
	}

	public onRawEvent(handler: (event: Buffer) => void): void {
		if (!this._permission.subscribeEvent) {
			return;
		}
		if (!this._eventHandlers.length) {
			(
				this._handlers.playlog.consumeEvent(this.playId, this._onBinaryEventBound).then(() => {
					// nothing to do
				}) as Promise<any>
			).catch(() => {
				throw createRuntimeError("failed to consume events.");
			});
		}
		this._eventHandlers.push(handler);
	}
	public offRawEvent(handler: (event: Buffer) => void): void {
		if (!this._permission.subscribeEvent) {
			return;
		}
		this._eventHandlers = this._eventHandlers.filter((h) => {
			return h !== handler;
		});
		if (!this._eventHandlers.length) {
			this._handlers.playlog
				.offConsumeEvent(this.playId, this._onBinaryEventBound)
				.catch((err) => this._logger.error("ServerEngineAMFlow#offRawEvent内のoffConsumeEventでエラー", err));
		}
	}
	public getTickList(_opts: amflow.GetTickListOptions, callback: (error: Error, tickList: playlog.TickList) => void): void;
	public getTickList(_begin: number, _end: number, _callback: (error: Error, tickList: playlog.TickList) => void): void;
	public getTickList(_a: any, _b: any, _c?: any) {
		throw createNotImplementedError("ServerEngineAMFlow doesn't implement getTickList(). Use getRawTickList() instead.");
	}
	public async getRawTickList(
		begin: number,
		end: number,
		callback: (error: Error, tickList: Buffer[]) => void,
		excludeEventFlags: ExcludeEventFlags,
	): Promise<void> {
		const err = this.errGetTickList();
		if (err) {
			callback(err, null);
			return;
		}
		try {
			let tickList: Buffer[];
			if (await this._isExcludedIgnorableGameCode()) {
				tickList = await this._handlers.request.getRawTickListExcludedIgnorable(this.playId, begin, end, excludeEventFlags);
			} else {
				tickList = await this._handlers.request.getRawTickList(this.playId, begin, end);
			}
			const err = this.errGetTickList();
			if (err) {
				callback(err, null);
			} else {
				callback(null, tickList);
			}
		} catch (error) {
			callback(createRuntimeError("failed to get TickList"), null);
		}
	}
	public putStartPoint(startPoint: amflow.StartPoint, callback: (error: Error) => void): void {
		let err = this.errPutStartPoint();
		if (err) {
			callback(err);
			return;
		}
		this._handlers.request
			.putStartPoint(this.playId, startPoint)
			.then(() => {
				err = this.errPutStartPoint();
				if (err) {
					callback(err);
				} else {
					callback(null);
				}
			})
			.catch(() => {
				callback(createRuntimeError("failed to put StartPoint"));
			});
	}
	public getStartPoint(opts: amflow.GetStartPointOptions, callback: (error: Error | null, startPoint?: amflow.StartPoint) => void): void {
		let err = this.errGetStartPoint();
		if (err) {
			callback(err, null);
			return;
		}
		this._handlers.request
			.getStartPoint(this.playId, opts)
			.then((startPoint) => {
				err = this.errGetStartPoint();
				if (err) {
					callback(err, null);
				} else {
					callback(null, startPoint);
				}
			})
			.catch(() => {
				callback(createRuntimeError("failed to get StartPoint"), null);
			});
	}
	public putStorageData(key: playlog.StorageKey, value: playlog.StorageValue, options: any, callback: (err: Error) => void): void {
		throw new Error("Storage Server is not available");
	}

	public getStorageData(keys: playlog.StorageReadKey[], callback: (error: Error, values: playlog.StorageData[]) => void): void {
		throw new Error("Storage Server is not available");
	}

	private async _isExcludedIgnorableGameCode(): Promise<boolean> {
		const gameCode = await this.getGameCode();
		if (gameCode === "nicocas") {
			return true;
		} else {
			return false;
		}
	}

	private _onBinaryTick(tick: Buffer): void {
		if (this._tokenHolder && this._tokenHolder.revoked) {
			this.logInSecond(() => {
				// TODO: 状況によってはログの大量出力の可能性あり(可能性低)
				this._logger.warn(
					"the tick would have been sent to the client was dropped because of revoked token. playId: %s, userId: %s",
					this.playId,
					this._tokenHolder.playToken.meta.userId,
				);
			});
			return;
		}
		for (let i = 0; i < this._tickHandlers.length; i++) {
			this._tickHandlers[i](tick);
		}
	}

	private _onBinaryEvent(event: Buffer): void {
		if (this._tokenHolder && this._tokenHolder.revoked) {
			this.logInSecond(() => {
				// TODO: 状況によってはログの大量出力の可能性あり(可能性低)
				this._logger.warn(
					"the event would have been sent to the client was dropped because of revoked token. playId: %s, userId: %s",
					this.playId,
					this._tokenHolder.playToken.meta.userId,
				);
			});
			return;
		}
		for (let i = 0; i < this._eventHandlers.length; i++) {
			this._eventHandlers[i](event);
		}
	}

	private _onPlayTokenRevoke(): void {
		// TODO:
		//   consume している tick/event を止める
		//   playlog-client へ通知する
	}

	private async getGameCode(): Promise<string> {
		if (this._gameCode) {
			return this._gameCode;
		}
		const play = await this._handlers.systemControlAPI.getPlay(this.playId);
		this._gameCode = play.gameCode;
		return play.gameCode;
	}

	private initPermission(): void {
		this._permission = {
			writeTick: false,
			readTick: false,
			sendEvent: false,
			subscribeEvent: false,
			subscribeTick: false,
			maxEventPriority: 0,
		};
	}

	private errGetTickList(): amflow.AMFlowError {
		let err: amflow.AMFlowError = null;
		if (!this._permission || !this._permission.readTick) {
			err = createPermissionError("no readTick permission");
		}
		if (this._tokenHolder && this._tokenHolder.revoked) {
			err = createTokenRevokedError();
		}
		return err;
	}

	private errPutStartPoint(): amflow.AMFlowError {
		let err: amflow.AMFlowError = null;
		if (!this._permission || !this._permission.writeTick) {
			err = createPermissionError("no writeTick permission");
		}
		if (this._tokenHolder && this._tokenHolder.revoked) {
			err = createTokenRevokedError();
		}
		return err;
	}

	private errGetStartPoint(): amflow.AMFlowError {
		let err: amflow.AMFlowError = null;
		if (!this._permission || (!this._permission.readTick && !this._permission.writeTick)) {
			err = createPermissionError("no readTick permission");
		}
		if (this._tokenHolder && this._tokenHolder.revoked) {
			err = createTokenRevokedError();
		}
		return err;
	}

	private logInSecond(logFunc: Function): void {
		const now = Date.now();
		if (now - this._beforeLogTime < 1000) {
			return;
		}
		this._beforeLogTime = now;
		logFunc();
	}
}

function createError(name: string, msg: string): amflow.AMFlowError {
	const err = new Error(msg) as amflow.AMFlowError;
	err.name = name;
	return err;
}

function createRuntimeError(message: string): amflow.AMFlowError {
	return createError("Runtimer", message);
}

function createPermissionError(message: string): amflow.AMFlowError {
	return createError("Permission", message);
}

function createNotImplementedError(message: string): amflow.AMFlowError {
	return createError("NotImplemented", message);
}

function createTokenRevokedError(): amflow.AMFlowError {
	return createError("TokenRevoked", "Authenticated token has been revoked");
}
