import { Errors } from "@akashic/akashic-rest-commons";
import * as Cast from "@akashic/cast-util";
import { Constants, Play, PlayToken, PlayTokenPermissionLike } from "@akashic/server-engine-data-types";
import * as express from "express";
import { LogUtil } from "@akashic/log-util";
import * as log4js from "log4js";
import { performance } from "perf_hooks";
import PermissionServerService from "../../../domain/services/PermissionServerService";
import PlayServerService from "../../../domain/services/PlayServerService";
import PlayTokenWithUrl from "../../../responses/PlayTokenWithUrl";
import { DispatcherBase } from "../../../services/DispatcherBase";
import * as ErrorConverters from "../../../utils/ErrorConverters";

export class TokensController {
	// タイムアウトするまでのミリ秒。
	private static readonly TIMEOUT_MSECS: number = 2000;

	private _dispatcher: DispatcherBase;
	private _client: PermissionServerService;
	private _playClient: PlayServerService;

	constructor(dispatcher: DispatcherBase, client: PermissionServerService, playClient: PlayServerService) {
		this._dispatcher = dispatcher;
		this._client = client;
		this._playClient = playClient;
	}

	/**
	 * プレートークン作成
	 * POST /v1.0/plays/:playId/tokens
	 */
	public post(req: express.Request, res: express.Response, next: Function): any {
		const startTime = performance.now();
		const logger = new LogUtil(log4js.getLogger("out"));
		let playId: string;
		let requestPermission: any;
		let postBody: any;
		let reserveEndpoint = true;

		try {
			playId = Cast.bigint(req.params.playId, false, "invalid play id");

			res.setTimeout(TokensController.TIMEOUT_MSECS, () => {
				logger.warn(`response timeout. playId: ${playId}`);
				return next(new Errors.Busy("response timeout"));
			});

			requestPermission = req.body.permission;

			if (req.body.reserveEndpoint !== undefined) {
				if (typeof req.body.reserveEndpoint !== "boolean") {
					throw new Error("invalid reserveEndpoint");
				} else {
					reserveEndpoint = req.body.reserveEndpoint;
				}
			}

			postBody = {
				userId: Cast.string(req.body.userId, PermissionServerService.limitUserIdLength, true, "invalid userId"),
				permission: this._client.toPlayTokenPermission(requestPermission),
				ttlsec: Cast.number(req.body.ttl, true, "invalid ttl"),
				trait: Cast.string(req.body.trait, 32, true, "invalid trait"),
				reserveEndpoint,
				meta: req.body.meta,
				forceAssignTo: Cast.string(req.body.forceAssignTo, undefined, true, "invalid forceAssignTo"),
			};
		} catch (error) {
			return next(new Errors.InvalidParameter("invalid parameter", error));
		}

		if (
			typeof postBody.userId === "string" && // 必須項目ではないので、受け取らなかった場合に string ではない
			postBody.userId.charAt(0) === ":"
		) {
			// ":" で始まるものは、 不正なものとして使われている実績がある
			throw next(new Errors.InvalidParameter("invalid parameter", new TypeError("user id should NOT start with ':'")));
		}

		this._playClient
			.getPlay(playId)
			.then((play: Play) => {
				if (!play) {
					return Promise.reject<PlayToken>(new Errors.NotFound("play not found"));
					// プレー終了後にWrite権限を要求してきたらはじく
					// Readははじかない（リプレイ再生などは終了後も行える必要があるため）
				} else if (play.status === Constants.PLAY_STATE_SUSPENDING && this._isWritableToken(postBody.permission)) {
					return Promise.reject<PlayToken>(new Errors.Conflict("play status conflict"));
				} else {
					return this._client.generateToken(playId, postBody.userId, postBody.permission, postBody.ttlsec, postBody.meta);
				}
			})
			.then((playToken) => {
				const tokenGeneratedTime = performance.now() - startTime;
				if (tokenGeneratedTime > 500) {
					logger.warn(`token generate time: ${tokenGeneratedTime} ms. playId: ${playId}`);
				}
				if (postBody.reserveEndpoint) {
					// トークンの生成とそれを用いたリソース割り当ては目的が異なるため別APIとしたいが、
					// 現状凸耐のため本APIに責務を集約する形にしている。
					return this._dispatcher
						.dispatch(playToken.playId, playToken.value, postBody.trait, postBody.forceAssignTo)
						.then((url: string) => PlayTokenWithUrl.fromTokenAndUrl(playToken, url, requestPermission))
						.catch((error: any) => {
							// Note: 割り当て不可のためトークン無効化し 503 を返す:
							return this._client
								.deleteToken(playToken.playId, playToken.value)
								.catch(Promise.resolve)
								.then(() => Promise.reject(this._createServiceUnavailableError(error)));
						});
				} else {
					return PlayTokenWithUrl.fromToken(playToken, requestPermission);
				}
			})
			.then((token) => {
				const processingTime = performance.now() - startTime;
				if (processingTime > 1000) {
					logger.warn(`processing time: ${processingTime} ms. playId: ${playId}`);
				}
				return token;
			})
			.then(res.json)
			.catch((error: any) => ErrorConverters.restClientErrorToApiError(error))
			.catch((error: any) => next(error));
	}

	public _isWritableToken(permission: PlayTokenPermissionLike): boolean {
		return permission.writeTick || permission.sendEvent;
	}

	public _createServiceUnavailableError(error: any): Errors.ApiError {
		class ServiceUnavailable extends Errors.ApiError {
			constructor(message: string, debug?: any) {
				super(message, "SERVICE_UNAVAILABLE", 503, debug);
			}
		}

		return new ServiceUnavailable("reservation could not be dispatched", error);
	}
}
