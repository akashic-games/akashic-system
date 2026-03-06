import * as RestCommons from "@akashic/akashic-rest-commons";
import { AmqpConnectionManager } from "@akashic/amqp-utils";
import { string as castString } from "@akashic/cast-util";
import { EventType, PlayTokenAMQP } from "@akashic/playtoken-amqp";
import * as dt from "@akashic/server-engine-data-types";

import { PlayTokenService } from "./PlayTokenService";
import ServerServiceMarkerInterface from "./ServerServiceMarkerInterface";
import { TokenGenerateService } from "./TokenGenerateService";

export default class PermissionServerService implements ServerServiceMarkerInterface {
	// ユーザ ID はシステムとして保持しないが、MQ や Cache に含めても問題ない程度の長さを制限とする:
	public static readonly limitUserIdLength = 1024;

	private generateTokenService: TokenGenerateService;
	private tokenService: PlayTokenService;
	private amqpConnectionManager: AmqpConnectionManager;

	public constructor(
		generateTokenService: TokenGenerateService,
		tokenService: PlayTokenService,
		amqpConnectionManager: AmqpConnectionManager,
	) {
		this.generateTokenService = generateTokenService;
		this.tokenService = tokenService;
		this.amqpConnectionManager = amqpConnectionManager;
	}

	/**
	 * トークンの発行
	 *
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
	): Promise<dt.PlayTokenLike> {
		const token = this.generateTokenService.generate(playId, userId, permission, ttl, meta);

		return this.tokenService.savePlayToken(token);
	}

	/**
	 * トークンの無効化
	 *
	 * DELETE /v1.0/plays/:playId/tokens/purge に対応する
	 * Errors
	 * * NOT FOUND トークンが見つからない
	 *
	 * @param playId 無効化対象のplayId
	 * @param token 無効化対象のtokenId
	 */
	public deleteToken(playId: string, token: string): Promise<void> {
		return this.tokenService
			.getPlayToken(playId, token)
			.then((playToken) => {
				if (!playToken) {
					return Promise.reject(new RestCommons.Errors.NotFound("not found play token"));
				} else {
					return this.tokenService.deletePlayToken(playId, token).then(() => playToken);
				}
			})
			.then((playToken: dt.PlayTokenLike) => {
				if (!("id" in playToken)) {
					return Promise.reject("playToken dose NOT have id field. playToken is PlayTokenLike, but NOT PlayToken.");
				}
				return this.amqpConnectionManager.publishObject(PlayTokenAMQP.EXCHANGE, String(EventType.Revoke), {
					playId,
					id: playToken.id,
				});
			});
	}

	/**
	 * トークン権限の更新
	 *
	 * PUT /v1.0/plays/permit に対応する
	 * Errors
	 * * NOT FOUND トークンが見つからない
	 *
	 * @param permission 更新対象の permission
	 * @param condition 更新対象をフィルタする playId, userId, tokenValue 条件
	 */
	public async updatePermission(
		permission: dt.PlayTokenPermissionLike,
		condition: { playId?: string; userId?: string; tokenValue?: string },
	): Promise<void> {
		const tokenIdResolver: Promise<string | undefined> =
			condition.playId && condition.tokenValue
				? this.tokenService.getPlayToken(condition.playId, condition.tokenValue).then((token) => token.id)
				: Promise.resolve(undefined);

		const tokenId = await tokenIdResolver;

		// TODO: 現状はキー設計の関係上、 playId と Token がないとストアのトークンが更新できない。
		// ストアは更新せず Playlog Server への認証済みトークン更新指示のみとする。
		return this.amqpConnectionManager.publishObject(PlayTokenAMQP.EXCHANGE, String(EventType.UpdatePermission), {
			id: tokenId,
			playId: condition.playId,
			userId: condition.userId,
			permission,
		});
	}

	/**
	 * Permission を表す文字列またはオブジェクトからの変換
	 * - 変換できない場合は例外送出する
	 */
	public toPlayTokenPermission(permission: any): dt.PlayTokenPermissionLike {
		if (typeof permission === "string") {
			permission = castString(permission, 32, false, "invalid permission");
			if (!/^[0-9]+$/.test(permission)) {
				throw new Error("invalid permission-string format");
			}
		}
		return dt.PlayTokenPermission.generate(permission);
	}

	// 使用されていないので、実装しない。
	// このAPI を使っているのは playlog-server から permission-server を使用している場合だけだったが、
	// 運用上、このAPI を使用することはなくなった。
	// API ドキュメントから削除されたわけではない（はず）なので、一応実装する余地だけは残しておく。
	//
	// /**
	//  * トークンを検証し、認証情報が正しければトークン情報を取得する
	//  *
	//  * POST/v1.0/tokens/validateに対応する
	//  * @param args 検証対象のトークン情報
	//  */
	// validateToken(args: requests.ValidateTokenRequest): Promise<dt.PlayToken> {
	// }
}
