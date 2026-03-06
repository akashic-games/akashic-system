import restClientCore = require("@akashic/rest-client-core");
import dt = require("@akashic/server-engine-data-types");
import BaseApiClient = require("./BaseApiClient");
import methodConfig = require("./config/methods");
import requests = require("./DataTypes");

/**
 * instance-server にリクエストを投げるクライアント
 */
class InstanceClient extends BaseApiClient {
	private createInstanceMethod: restClientCore.Method<dt.Instance>;
	private deleteInstanceMethod: restClientCore.Method<void>;
	private getInstancesByPlayIdMethod: restClientCore.Method<dt.PagingResponse<dt.Instance>>;
	private getInstanceMethod: restClientCore.Method<dt.Instance>;
	private findInstanceMethod: restClientCore.Method<dt.PagingResponse<dt.Instance>>;
	private patchInstanceMethod: restClientCore.Method<void>;
	private getVideoSettingsMethod: restClientCore.Method<dt.PagingResponse<dt.VideoSetting>>;
	private getVideoSettingMethod: restClientCore.Method<dt.VideoSetting>;
	/**
	 * @param baseUrl instance-serverの基底URL
	 */
	constructor(baseUrl: string) {
		super(baseUrl);
		const methods = methodConfig.instance;
		this.createInstanceMethod = this.getMethod(methods.createInstance, (data) => dt.Instance.fromObject(data));
		this.deleteInstanceMethod = this.getMethod(methods.deleteInstance, (data) => data);
		this.getInstancesByPlayIdMethod = this.getMethod(methods.getInstancesByPlayId, (data) =>
			dt.PagingResponse.fromObject(data, dt.Instance),
		);
		this.getInstanceMethod = this.getMethod(methods.getInstance, (data) => dt.Instance.fromObject(data));
		this.findInstanceMethod = this.getMethod(methods.findInstance, (data) => dt.PagingResponse.fromObject(data, dt.Instance));
		this.patchInstanceMethod = this.getMethod(methods.patchInstance, (data) => data);
		this.getVideoSettingsMethod = this.getMethod(methods.getVideoSettings, (data) => dt.PagingResponse.fromObject(data, dt.VideoSetting));
		this.getVideoSettingMethod = this.getMethod(methods.getVideoSetting, (data) => dt.VideoSetting.fromObject(data));
	}
	/**
	 * akashic-cluster-master経由でインスタンスを作成する
	 *
	 * POST /v1.0/instancesに対応する
	 *
	 * Errors
	 * * Bad Request マスターじゃない状態のサーバに対してリクエストを投げた
	 * * Invalid Parameter リクエストに間違いがある
	 */
	public createInstance(args: requests.CreateInstanceRequest) {
		return this.createInstanceMethod.exec({}, args);
	}
	/**
	 * akashic-cluster-master経由でインスタンスを停止する
	 *
	 * DELETE /v1.0/instances/:id に対応する
	 *
	 * Errors
	 * * NOT FOUND インスタンスが見つからない
	 * * Conflict 終了中や終了済み、エラーで停止したインスタンスを停止しようとした
	 * @param instanceId {string} 終了するインスタンスのID
	 */
	public deletetInstance(instanceId: string) {
		return this.deleteInstanceMethod.exec({
			id: instanceId,
		});
	}
	/**
	 * 複数のインスタンス情報を取得する
	 *
	 * GET /v1.0/plays/:playId/instances に対応する
	 * @param playId 取得するインスタンスのplayId
	 */
	public getInstancesByPlayId(playId: string) {
		return this.getInstancesByPlayIdMethod.exec({ playId });
	}
	/**
	 * インスタンス情報を取得する
	 *
	 * GET /v1.0/instances/:id に対応する
	 *
	 * Errors
	 * * NOT FOUND インスタンスが見つからない
	 * @param instanceId 取得するインスタンスのID
	 */
	public getInstance(instanceId: string) {
		return this.getInstanceMethod.exec({
			id: instanceId,
		});
	}
	/**
	 * インスタンスを更新する
	 *
	 * PATCH /v1.0/instances/:instanceId に対応する
	 *
	 * Errors
	 * * Bad Request マスターじゃない状態のサーバに対してリクエストを投げた
	 * * Invalid Parameter リクエストに間違いがある
	 */
	public patchInstance(instanceId: string, args: requests.PatchInstanceRequest) {
		return this.patchInstanceMethod.exec(
			{
				id: instanceId,
			},
			args,
		);
	}

	/**
	 * インスタンスを検索する
	 *
	 * GET /v1.0/instances
	 *
	 * Errors
	 * * Invalid Parameter リクエストに間違いがある
	 */
	public findInstances(args: requests.FindInstancesRequest) {
		return this.findInstanceMethod.exec(args);
	}

	/**
	 * 複数の映像出力情報を取得する。
	 * 主にSystemAPIからgamesレスポンスを結合して返す用
	 *
	 * GET /v1.0/videoSettingsに対応する。
	 * @param instanceIds 取得対象のinstanceId一覧
	 */
	public getVideoSettings(instanceIds: string[]) {
		return this.getVideoSettingsMethod.exec({
			instanceIds,
		});
	}
	/**
	 * 映像出力情報を取得する
	 *
	 * GET /v1.0/instances/:instanceId/videoSettingに対応する
	 *
	 * Errors
	 * * NOT FOUND インスタンスが見つからない、または映像出力情報が見つからない
	 * @param playId 取得する映像出力情報のplayId
	 * @param instanceId 取得する映像出力情報のinstanceId
	 */
	public getVideoSetting(instanceId: string) {
		return this.getVideoSettingMethod.exec({
			id: instanceId,
		});
	}
}
export = InstanceClient;
