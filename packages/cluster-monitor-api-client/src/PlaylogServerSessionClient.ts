import restClientCore from "@akashic/rest-client-core";
import { NicoApiResponse } from "@akashic/rest-client-core";
import BaseApiClient from "./BaseApiClient";
import { PlaylogServerSessionsResponse } from "./DataTypes";

export default class PlaylogServerSessionClient extends BaseApiClient {
	private getSessionInfoMethod: restClientCore.Method<PlaylogServerSessionsResponse[]>;
	constructor(baseUrl: string) {
		super(baseUrl);
		this.getSessionInfoMethod = this.getMethod({ path: "/v1.0/sessions", method: "GET" }, (data) => data);
	}
	public getSessionInfo(): Promise<NicoApiResponse<PlaylogServerSessionsResponse[]>> {
		return this.getSessionInfoMethod.exec();
	}
}
