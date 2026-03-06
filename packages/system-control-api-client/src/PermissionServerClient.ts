import restClientCore = require("@akashic/rest-client-core");
import dt = require("@akashic/server-engine-data-types");
import BaseApiClient = require("./BaseApiClient");
import methodConfig = require("./config/methods");
import requests = require("./DataTypes");

/**
 * Permission Serverにリクエストを投げるクライアント
 */
class PermissionServerClient extends BaseApiClient {
	private generateTokenMethod: restClientCore.Method<dt.PlayToken>;
	private deleteTokenMethod: restClientCore.Method<void>;
	private validateTokenMethod: restClientCore.Method<dt.PlayToken | null>;

	/**
	 * @param baseUrl Permission Serverの基底URL
	 */
	constructor(baseUrl: string) {
		const methods = methodConfig.permissionServer;
		super(baseUrl);
		this.generateTokenMethod = this.getMethod<dt.PlayToken>(methods.generateToken, (data) => dt.PlayToken.fromObject(data));
		this.deleteTokenMethod = this.getMethod<void>(methods.deleteToken, (data) => data);
		this.validateTokenMethod = this.getMethod<dt.PlayToken | null>(methods.validateToken, (data) => {
			if (!data) {
				return null;
			}
			return dt.PlayToken.fromObject(data);
		});
	}
	/**
	 * トークンの発行
	 *
	 * POST /v1.0/plays/:playId/tokensに対応する
	 *
	 * Errors
	 * * Invalid Parameter 発行のための情報に間違いがある
	 * @param playId 発行対象のplayId
	 * @param userId 発行対象のAkashic userId
	 * @param permission 発行するトークンの権限フラグ文字列、または権限を表すオブジェクト(PlayTokenPermission)
	 * @param ttl 発行するトークンの有効時間(秒)。
	 * @param meta トークンに付与するメタデータ
	 */
	public generateToken(
		playId: string,
		userId: string,
		permission: any,
		ttl?: number,
		meta?: dt.PlayTokenMetaLike,
	): Promise<restClientCore.NicoApiResponse<dt.PlayToken>> {
		return this.generateTokenMethod.exec({ playId }, { userId, permission, ttl, meta });
	}
	/**
	 * トークンの無効化
	 *
	 * DELETE /v1.0/plays/:playId/tokens/purge に対応する
	 * Errors
	 * * NOT FOUND トークンが見つからない
	 * @param playId 無効化対象のplayId
	 * @param value
	 */
	public deleteToken(playId: string, value: string): Promise<restClientCore.NicoApiResponse<void>> {
		return this.deleteTokenMethod.exec({ playId }, { value });
	}
	/**
	 * トークンを検証し、認証情報が正しければトークン情報を取得する
	 *
	 * POST/v1.0/tokens/validateに対応する
	 * @param args 検証対象のトークン情報
	 */
	public validateToken(args: requests.ValidateTokenRequest): Promise<restClientCore.NicoApiResponse<dt.PlayToken | null>> {
		return this.validateTokenMethod.exec(undefined, args);
	}
}
export = PermissionServerClient;
