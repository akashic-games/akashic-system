import Cast = require("@akashic/cast-util");
import crypto = require("crypto");
import TokenGenerator = require("../services/TokenGenerator");
import TokenHashLength = require("../services/TokenHashLength");
import PlayTokenLike = require("./PlayTokenLike");
import { PlayTokenMetaLike } from "./PlayTokenMetaLike";
import { PlayTokenPermission } from "./PlayTokenPermission";
import { PlayTokenPermissionLike } from "./PlayTokenPermissionLike";

class PlayToken implements PlayTokenLike {
	get id(): string {
		return this._id;
	}

	get playId(): string {
		return this._playId;
	}

	get value(): string {
		return this._value;
	}

	get hash(): string {
		return this._hash;
	}

	get expire(): Date {
		return this._expire;
	}

	get permission(): PlayTokenPermission {
		return this._permission;
	}

	get meta(): PlayTokenMetaLike {
		return this._meta;
	}

	public static fromObject(obj: any): PlayToken {
		if (!obj) {
			throw new TypeError("obj is not valid");
		}
		return new PlayToken({
			id: Cast.bigint(obj.id, true, "property id is not valid"),
			playId: Cast.bigint(obj.playId, false, "property playId is not valid"),
			value: Cast.uriUnreserved(obj.value, 64, false, "property value is not valid"),
			hash: Cast.uriUnreserved(obj.hash, 64, false, "property hash is not valid"),
			expire: Cast.date(obj.expire, false, "property expire"),
			permission: PlayTokenPermission.generate(obj.permission),
			meta: obj.meta,
		});
	}
	public static generatePlayToken(
		playId: string,
		salt: string,
		expire: Date,
		permission: PlayTokenPermissionLike,
		meta?: PlayTokenMetaLike,
	): PlayToken {
		// tokenの安全性は秘密文字列+ある程度の強度の乱数で確保する。
		const generator = new TokenGenerator(salt, this._tokenHashBitLength);
		const random = crypto.pseudoRandomBytes(32).toString("base64");
		const token = generator.generate(playId, random);
		// validateに使うハッシュをtokenから生成する
		const hash = generator.generate(token);
		const _permission = PlayTokenPermission.generate(permission);
		return new PlayToken({
			playId,
			value: token,
			hash,
			expire,
			permission: _permission,
			meta,
		});
	}
	private static _tokenHashBitLength = TokenHashLength.Length256; // トークンのハッシュ長は256bit
	private _id: string;
	private _playId: string;
	private _value: string;
	private _hash: string;
	private _expire: Date;
	private _permission: PlayTokenPermission;
	private _meta: PlayTokenMetaLike;
	constructor(args: PlayTokenLike, id?: string, meta?: PlayTokenMetaLike) {
		this._playId = args.playId;
		this._value = args.value;
		this._hash = args.hash;
		this._expire = args.expire;
		this._permission = new PlayTokenPermission(args.permission);
		this._id = typeof id !== "undefined" ? id : args.id;
		this._meta = meta ? meta : args.meta;
	}

	/**
	 * パラメータを変更したPlayTokenオブジェクトを取得する
	 */
	public update(updateArgs: { permission?: any }): PlayToken {
		return new PlayToken({
			id: this.id,
			playId: this.playId,
			value: this.value,
			hash: this.hash,
			expire: this.expire,
			permission: updateArgs.permission ? PlayTokenPermission.generate(updateArgs.permission) : this.permission,
			meta: this.meta,
		});
	}

	public toJSON(): PlayTokenLike {
		const result: PlayTokenLike = {
			playId: this.playId,
			value: this.value,
			hash: this.hash,
			expire: this.expire,
			permission: this.permission.toJSON(),
			meta: this.meta,
		};
		if (typeof this.id !== "undefined") {
			result.id = this.id;
		}
		return result;
	}
}
export = PlayToken;
