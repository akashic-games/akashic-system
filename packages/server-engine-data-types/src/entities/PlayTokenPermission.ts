import Cast = require("@akashic/cast-util");
import Constants = require("../constants");
import { PlayTokenPermissionLike } from "./PlayTokenPermissionLike";

export class PlayTokenPermission implements PlayTokenPermissionLike {
	/**
	 * Tickを記録する権限を持つかどうか
	 */
	get writeTick(): boolean {
		return this._writeTick;
	}
	/**
	 * Tickを読み込む権限を持つかどうか
	 */
	get readTick(): boolean {
		return this._readTick;
	}
	/**
	 * リアルタイムに発行されるTickを受信する権限を持つかどうか
	 */
	get subscribeTick(): boolean {
		return this._subscribeTick;
	}
	/**
	 * イベントを送信する権限を持つかどうか
	 */
	get sendEvent(): boolean {
		return this._sendEvent;
	}
	/**
	 * 送信されたイベントを受信する権限を持つかどうか
	 */
	get subscribeEvent(): boolean {
		return this._subscribeEvent;
	}
	/**
	 * 送信できるイベントに指定できる最大優先度
	 */
	get maxEventPriority(): number {
		return this._maxEventPriority;
	}

	public static generate(args: any): PlayTokenPermission {
		if (typeof args === "string") {
			return this.fromString(args);
		} else {
			return this.fromObject(args);
		}
	}

	private static fromObject(obj: any): PlayTokenPermission {
		if (!obj) {
			throw new TypeError("PlayToken Permission is not valid.");
		}
		const priority: number = obj.maxEventPriority ? obj.maxEventPriority : 0;
		return new PlayTokenPermission({
			writeTick: Boolean(obj.writeTick),
			readTick: Boolean(obj.readTick),
			subscribeTick: Boolean(obj.subscribeTick),
			sendEvent: Boolean(obj.sendEvent),
			subscribeEvent: Boolean(obj.subscribeEvent),
			maxEventPriority: Cast.rangeInt(priority, 0, 3, false, "permission.maxEventPriority is not valid"),
		});
	}

	private static fromString(permission: string): PlayTokenPermission {
		const _readFlag: number = Number(permission.substr(Constants.PERMISSION_FLAG_INDEX.READ, 1));
		const _writeFlag: number = Number(permission.substr(Constants.PERMISSION_FLAG_INDEX.WRITE, 1));
		const _subscribeFlag: number = Number(permission.substr(Constants.PERMISSION_FLAG_INDEX.EVENT_SUBSCRIBE, 1));

		/**
		 * 文字列指定のread権限を持つ場合は、 tickのreadとsubscribeが有効になります
		 */
		const readTickAndSubscribe: boolean = _readFlag === Constants.PERMISSION_READ_FLAG_VALUES.ENABLED;
		const writeTick: boolean =
			(_writeFlag & Constants.PERMISSION_WRITE_FLAG_VALUES.ENABLE_PLAYLOG) === Constants.PERMISSION_WRITE_FLAG_VALUES.ENABLE_PLAYLOG;
		const subscribeEvent: boolean = _subscribeFlag === Constants.PERMISSION_EVENT_READ_FLAG_VALUES.ENABLED;
		const isMainPlayer: boolean =
			(_writeFlag & Constants.PERMISSION_WRITE_FLAG_VALUES.ENABLE_MAIN_PLAYER_EVENT) ===
			Constants.PERMISSION_WRITE_FLAG_VALUES.ENABLE_MAIN_PLAYER_EVENT;
		const isSubPlayer: boolean =
			(_writeFlag & Constants.PERMISSION_WRITE_FLAG_VALUES.ENABLE_SUB_PLAYER_EVENT) ===
			Constants.PERMISSION_WRITE_FLAG_VALUES.ENABLE_SUB_PLAYER_EVENT;
		const sendEvent: boolean = isMainPlayer || isSubPlayer;
		const maxEventPriority = (isMain: boolean, isSub: boolean): number => {
			if (isMain) {
				return 2;
			}
			if (isSub) {
				return 1;
			}
			return 0;
		};
		return new PlayTokenPermission({
			writeTick,
			readTick: readTickAndSubscribe,
			subscribeTick: readTickAndSubscribe,
			sendEvent,
			subscribeEvent,
			maxEventPriority: maxEventPriority(isMainPlayer, isSubPlayer),
		});
	}
	private _writeTick: boolean;
	private _readTick: boolean;
	private _subscribeTick: boolean;
	private _sendEvent: boolean;
	private _subscribeEvent: boolean;
	private _maxEventPriority: number;

	constructor(args: PlayTokenPermissionLike) {
		this._writeTick = args.writeTick;
		this._readTick = args.readTick;
		this._subscribeTick = args.subscribeTick;
		this._sendEvent = args.sendEvent;
		this._subscribeEvent = args.subscribeEvent;
		this._maxEventPriority = args.maxEventPriority;
	}

	public toJSON(): PlayTokenPermissionLike {
		return {
			writeTick: this.writeTick,
			readTick: this.readTick,
			subscribeTick: this.subscribeTick,
			sendEvent: this.sendEvent,
			subscribeEvent: this.subscribeEvent,
			maxEventPriority: this.maxEventPriority,
		};
	}
}
