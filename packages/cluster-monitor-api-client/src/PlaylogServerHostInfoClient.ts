import restClientCore from "@akashic/rest-client-core";
import { PagingResponse } from "@akashic/server-engine-data-types";
import BaseApiClient from "./BaseApiClient";
import methodConfig from "./config/methods";
import { PlaylogServerHostInfo } from "./DataTypes";

export default class PlaylogServerHostInfoClient extends BaseApiClient {
	private readonly getPlaylogServerHostsMethod: restClientCore.Method<PagingResponse<PlaylogServerHostInfo>>;

	constructor(baseUrl: string) {
		super(baseUrl);
		const methods = methodConfig.playlogServerHost;
		this.getPlaylogServerHostsMethod = this.getMethod(methods.getPlaylogServerHosts, (data) => data);
	}

	public getPlaylogServerHosts(): Promise<restClientCore.NicoApiResponse<PagingResponse<PlaylogServerHostInfo>>> {
		return this.getPlaylogServerHostsMethod.exec();
	}
}
