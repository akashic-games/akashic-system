import { Method, NicoApiResponse } from "@akashic/rest-client-core";
import { BaseApiClient } from "./BaseApiClient";
import * as dt from "./DataTypes";
import methods from "./methods";

/**
 * Dispatcher client.
 */
export class DispatcherClient extends BaseApiClient {
	private _reservePlayMethod: Method<dt.Reservation>;

	constructor(baseUrl: string) {
		super(baseUrl);
		this._reservePlayMethod = this.createMethod(methods.reservePlay);
	}

	public reservePlay(trait: string, playId: string, playToken: string): Promise<NicoApiResponse<dt.Reservation>> {
		return this._reservePlayMethod.exec({ trait, playId }, { playToken });
	}
}
