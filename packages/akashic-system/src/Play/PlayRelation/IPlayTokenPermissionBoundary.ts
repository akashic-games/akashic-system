import * as DataTypes from "@akashic/server-engine-data-types";

export interface IPlayTokenPermissionBoundary {
	/**
	 * 子プレーに対して追加で付与するパーミッションを指定する。
	 * 子プレーのパーミッションは (親プレーのパーミッション) || allow に設定される。
	 */
	allow?: DataTypes.PlayTokenPermissionLike;
	/**
	 * 子プレーに対して落とすパーミッションを指定する。
	 * 子プレーのパーミッションは (親プレーのパーミッション) && ~deny に設定される。
	 */
	deny?: DataTypes.PlayTokenPermissionLike;
	/**
	 * 子プレー認証を許可するために必要な PlayToken の meta フラグ名を指定する
	 * このパラメータが指定されている場合、子プレー認証時に PlayToken の meta 情報が参照される。
	 * meta[authorizedFlag] が true の場合にのみ子プレー認証が許可される。
	 *
	 * このパラメータが省略された場合は、チェックは行われず、全ての PlayToken に対して
	 * 子プレー認証が許可される。
	 */
	authorizedFlag?: string;
}
