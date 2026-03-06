import { PlayTokenMetaLike } from "./PlayTokenMetaLike";
import { PlayTokenPermissionLike } from "./PlayTokenPermissionLike";

interface PlayTokenLike {
	/**
	 * サロゲートキー
	 */
	id?: string;
	/**
	 * 操作許可対象のプレイID
	 */
	playId: string;
	/**
	 * 発行したトークン
	 */
	value: string;
	/**
	 * valueのハッシュ
	 */
	hash: string;
	/**
	 * 有効期限
	 */
	expire: Date;
	/**
	 * 権限
	 */
	permission: PlayTokenPermissionLike;
	/**
	 * トークンと紐付けたいメタ情報
	 */
	meta?: PlayTokenMetaLike;
}
export = PlayTokenLike;
