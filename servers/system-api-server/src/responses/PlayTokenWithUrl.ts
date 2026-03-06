// PlayTokenMetaLike が export * で宣言されているため、こちら側で明示的に名前を付ける必要がある
import { PlayTokenLike, PlayTokenMetaLike, PlayTokenPermission } from "@akashic/server-engine-data-types";
import { PlayTokenWithUrlLike } from "./PlayTokenWithUrlLike";

/**
 * プレイトークンのSystemAPIレスポンス用Entity
 */
export default class PlayTokenWithUrl implements PlayTokenWithUrlLike {
	get id(): string {
		return this._id;
	}

	get playId(): string {
		return this._playId;
	}

	get value(): string {
		return this._value;
	}

	get expire(): Date {
		return this._expire;
	}

	get url(): string {
		return this._url;
	}

	get permission(): any {
		return this._permission;
	}

	get meta(): PlayTokenMetaLike {
		return this._meta;
	}

	public static fromToken(token: PlayTokenLike, requestPermission: any): PlayTokenWithUrl {
		return new PlayTokenWithUrl(
			{
				id: token.id,
				playId: token.playId,
				value: token.value,
				expire: token.expire,
				permission: token.permission,
				meta: token.meta,
			},
			requestPermission,
		);
	}

	public static fromTokenAndUrl(token: PlayTokenLike, url: string, requestPermission: any): PlayTokenWithUrl {
		return new PlayTokenWithUrl(
			{
				id: token.id,
				playId: token.playId,
				value: token.value,
				expire: token.expire,
				url,
				permission: token.permission,
				meta: token.meta,
			},
			requestPermission,
		);
	}
	private _id: string;
	private _playId: string;
	private _value: string;
	private _expire: Date;
	private _url: string;
	private _permission: any;
	private _meta: PlayTokenMetaLike;

	constructor(args: PlayTokenWithUrlLike, requestPermission: any) {
		this._id = args.id;
		this._playId = args.playId;
		this._value = args.value;
		this._url = args.url;
		this._expire = args.expire;
		/**
		 * リクエスト時のpermission表現がstring(120等)だった場合、PlayTokenPermission ではなく
		 * リクエストされたままの文字列を返します
		 */
		this._permission = typeof requestPermission === "string" ? requestPermission : new PlayTokenPermission(args.permission);
		this._meta = args.meta;
	}

	public toJSON(): PlayTokenWithUrlLike {
		const result: PlayTokenWithUrlLike = {
			id: this.id,
			playId: this.playId,
			value: this.value,
			expire: this.expire,
			permission: this._permission,
			meta: this.meta,
		};
		if (this._url !== undefined) {
			result.url = this._url;
		}
		return result;
	}
}
