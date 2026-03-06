import restClientCore = require("@akashic/rest-client-core");
import NicoApiResponse = require("@akashic/rest-client-core/lib/NicoApiResponse");
import dt = require("@akashic/server-engine-data-types");
import BaseApiClient = require("./BaseApiClient");
import methodConfig = require("./config/methods");

/**
 * akashic-cluster-master Serverにリクエストを投げるクライアント
 */
class MasterClient extends BaseApiClient {
	private patchInstanceMethod: restClientCore.Method<dt.Instance>;
	private isMasterMethod: restClientCore.Method<{ isMaster: boolean }>;

	/**
	 * @param baseUrl akashic-cluster-masterの基底URL
	 */
	constructor(baseUrl: string) {
		super(baseUrl);
		const methods = methodConfig.master;
		this.patchInstanceMethod = this.getMethod(methods.patchInstance, (data) => dt.Instance.fromObject(data));
		this.isMasterMethod = this.getMethod(methods.isMaster, (data) => data);
	}
	/**
	 * インスタンスの状態を更新する
	 *
	 * PATCH /v1.0/instances/:id に対応する
	 *
	 * Errors
	 * * Bad Request マスターじゃない状態のサーバに対してリクエストを投げた
	 * * Invalid Parameter リクエストに間違いがある
	 */
	public patchInstance(instanceId: string, status: string) {
		return this.patchInstanceMethod.exec({ id: instanceId }, { status });
	}
	/**
	 * masterかどうかを取得する
	 *
	 * GET /v1.0/master/state
	 */
	public isMaster(): Promise<NicoApiResponse<{ isMaster: boolean }>> {
		return this.isMasterMethod.exec({});
	}
}
export = MasterClient;
