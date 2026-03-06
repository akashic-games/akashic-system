import { Log4jsAppender, Logger } from "@akashic-system/logger";
import { LogUtil } from "@akashic/log-util";
import restClientCore = require("@akashic/rest-client-core");
import dt = require("@akashic/server-engine-data-types");
import BaseApiClient = require("./BaseApiClient");
import methodConfig = require("./config/methods");
import requests = require("./DataTypes");

/**
 * Play Serverにリクエストを投げるクライアント
 */
class PlayClient extends BaseApiClient {
	private getPlaysMethod: restClientCore.Method<dt.PagingResponse<dt.Play>>;
	private createPlayMethod: restClientCore.Method<dt.Play>;
	private getPlayMethod: restClientCore.Method<dt.Play>;
	private patchPlayMethod: restClientCore.Method<void>;
	private stopPlayMethod: restClientCore.Method<void>;
	private createPlayChildrenMethod: restClientCore.Method<void>;
	private deletePlayChildrenMethod: restClientCore.Method<void>;

	/**
	 * @param baseUrl Play Serverの基底URL
	 */
	constructor(baseUrl: string, logger?: LogUtil) {
		super(baseUrl);
		// playlog-serverとの互換性維持のためのコード
		if (logger) {
			this.logger = new Logger([new Log4jsAppender(logger.baseLogger)]);
		}
		const methods = methodConfig.play;
		this.getPlaysMethod = this.getMethod(methods.getPlays, (data) => dt.PagingResponse.fromObject(data, dt.Play));
		this.createPlayMethod = this.getMethod(methods.createPlay, (data) => dt.Play.fromObject(data));
		this.getPlayMethod = this.getMethod(methods.getPlay, (data) => dt.Play.fromObject(data));
		this.patchPlayMethod = this.getMethod(methods.patchPlay, (data) => data);
		this.stopPlayMethod = this.getMethod(methods.stopPlay, (data) => data);
		this.createPlayChildrenMethod = this.getMethod(methods.createPlayChildren, (data) => data);
		this.deletePlayChildrenMethod = this.getMethod(methods.deletePlayChildren, (data) => data);
	}
	/**
	 * 複数のPlay情報を取得する
	 *
	 * GET /v1.0/playsに対応する
	 * @param args play情報を取得するための引数
	 */
	public getPlays(args: requests.GetPlaysRequest): Promise<restClientCore.NicoApiResponse<dt.PagingResponse<dt.Play>>> {
		return this.getPlaysMethod.exec(args);
	}
	/**
	 * Playを作成する
	 *
	 * POST /v1.0/playsに対応する
	 *
	 * Errors
	 * * Invalid Parameter 作成情報にエラーがあるとき
	 * @param args 作成するPlayの情報
	 */
	public createPlay(args: requests.CreatePlayRequest) {
		return this.createPlayMethod.exec(undefined, args);
	}
	/**
	 * Playの情報を取得する
	 *
	 * GET /v1.0/plays/:idに対応する
	 *
	 * Errors
	 * * NOT FOUND Play情報が見つからない時
	 * @param id 取得するPlayのplayId
	 */
	public getPlay(id: string) {
		return this.getPlayMethod.exec({ id });
	}
	/**
	 * Playの情報を更新する
	 *
	 * PATCH /v1.0/plays/:id
	 *
	 * Errors
	 * * NOT FOUND Play情報が見つからない時
	 * @param id 更新するPlayのplayId
	 * @param args 更新する情報
	 */
	public patchPlay(id: string, args: requests.PatchPlayRequest) {
		return this.patchPlayMethod.exec({ id }, args);
	}
	/**
	 * Playを終了する
	 *
	 * DELETE /v1.0/plays/:idに対応する
	 *
	 * Errors
	 * * NOT FOUND Play情報が見つからない時
	 * * Conflict 終了済みやエラーとなったPlayを終了した場合
	 * @param id 終了するPlayのplayId
	 */
	public stopPlay(id: string) {
		return this.stopPlayMethod.exec({ id });
	}

	/**
	 * プレーの親子関係を作成する
	 *
	 * POST /v1.0/plays/:id/children に対応する
	 *
	 * Errors
	 * * NOT FOUND Play情報が見つからない時
	 * @param id 親となるプレーのID
	 * @param childId 子となるプレーのID
	 * @param allow 子プレーに強制付加するパーミッション
	 * @param deny 子プレーに強制削除するパーミッション
	 */
	public createPlayChildren(id: string, childId: string, allow?: dt.PlayTokenPermissionLike, deny?: dt.PlayTokenPermissionLike) {
		return this.createPlayChildrenMethod.exec({ id }, { childId, allow, deny });
	}

	/**
	 * プレーの親子関係を削除する
	 *
	 * DELETE /v1.0/plays/:id/children/:childId に対応する
	 *
	 * @param id 親となるプレーのID
	 * @param childId 子となるプレーのID
	 */
	public deletePlayChildren(id: string, childId: string) {
		return this.deletePlayChildrenMethod.exec({ id, childId });
	}
}
export = PlayClient;
