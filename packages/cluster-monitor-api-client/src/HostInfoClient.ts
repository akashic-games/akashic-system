import restClientCore from "@akashic/rest-client-core";
import { PagingResponse } from "@akashic/server-engine-data-types";
import BaseApiClient from "./BaseApiClient";
import methodConfig from "./config/methods";

export default class HostInfoClient extends BaseApiClient {
	private readonly getHostsMethod: restClientCore.Method<PagingResponse<string>>;

	constructor(baseUrl: string) {
		super(baseUrl);
		const methods = methodConfig.host;
		this.getHostsMethod = this.getMethod(methods.getHosts, (data) => data);
	}

	public getHosts(): Promise<restClientCore.NicoApiResponse<PagingResponse<string>>> {
		return this.getHostsMethod.exec();
	}
}
