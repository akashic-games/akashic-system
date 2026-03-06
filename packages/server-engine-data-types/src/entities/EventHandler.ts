import Cast = require("@akashic/cast-util");
import { EventHandlerLike } from "./EventHandlerLike";

export class EventHandler implements EventHandlerLike {
	/**
	 * イベントハンドラのID
	 */
	get id(): string {
		return this._id;
	}
	/**
	 * イベントハンドラ種別
	 */
	get type(): string {
		return this._type;
	}
	/**
	 * イベント通知先
	 */
	get endpoint(): string {
		return this._endpoint;
	}
	/**
	 * イベント通知方法
	 */
	get protocol(): string {
		return this._protocol;
	}
	public static fromObject(obj: any): EventHandler {
		if (!obj) {
			throw new TypeError("obj is not valid");
		}
		return new EventHandler({
			id: Cast.bigint(obj.id, true, "property id is not valid"),
			type: Cast.string(obj.type, 32, false, "property type is not valid"),
			endpoint: Cast.ascii(obj.endpoint, 512, false, "property endpoint is not valid"),
			protocol: Cast.string(obj.protocol, 32, false, "property protocol is not valid"),
		});
	}
	private _id: string;
	private _type: string;
	private _endpoint: string;
	private _protocol: string;
	constructor(args: EventHandlerLike, id?: string) {
		this._type = args.type;
		this._endpoint = args.endpoint;
		this._protocol = args.protocol;
		this._id = typeof id !== "undefined" ? id : args.id;
	}
	public toJSON(): EventHandlerLike {
		const result: EventHandlerLike = {
			type: this._type,
			endpoint: this._endpoint,
			protocol: this._protocol,
		};
		if (typeof this.id !== "undefined") {
			result.id = this.id;
		}
		return result;
	}
}
