import restClientCore = require("@akashic/rest-client-core");
import { NicoApiResponse } from "@akashic/rest-client-core";
import BaseApiClient = require("./BaseApiClient");
import methodConfig = require("./config/methods");
import { PlaylogServerMode, PlaylogServers } from "./DataTypes";

/**
 * cluster-monitor-api-server にリクエストを投げるクライアント
 */
class PlaylogServerInfoClient extends BaseApiClient {
	private getPlaylogServersMethod: restClientCore.Method<PlaylogServers>;
	private putPlaylogServerModeMethod: restClientCore.Method<PlaylogServerMode>;
	/**
	 * @param baseUrl playlog-server-info-api-serverの基底URL
	 */
	constructor(baseUrl: string) {
		super(baseUrl);
		const methods = methodConfig.playlog;
		this.getPlaylogServersMethod = this.getMethod(methods.getPlaylogServers, (data) => data);
		this.putPlaylogServerModeMethod = this.getMethod(methods.putPlaylogServerMode, (data) => data);
	}
	public getPlaylogServers(condition?: { hostname?: string; trait?: string }): Promise<NicoApiResponse<PlaylogServers>> {
		return this.getPlaylogServersMethod.exec(condition || {});
	}
	public putPlaylogServerMode(sessionName: string, mode: string): Promise<NicoApiResponse<PlaylogServerMode>> {
		return this.putPlaylogServerModeMethod.exec(undefined, { sessionName, mode });
	}
}
export = PlaylogServerInfoClient;
