import lu = require("@akashic/log-util");
import restClientCore = require("@akashic/rest-client-core");
import dt = require("@akashic/server-engine-data-types");
import controlAPI = require("@akashic/system-control-api-client");
import config = require("config");

export class SystemControlAPIHandler {
	private _playClient: controlAPI.PlayClient;

	constructor(logger: lu.LogUtil) {
		this._playClient = new controlAPI.PlayClient(config.get<string>("endpoints.system-api-server"), logger);
	}

	public getPlay(playId: string): Promise<dt.Play> {
		return this._systemControlAPIRequest(this._playClient.getPlay(playId));
	}

	private _systemControlAPIRequest<T>(req: Promise<restClientCore.NicoApiResponse<T>>): Promise<T> {
		return req.then(
			(res: restClientCore.NicoApiResponse<T>) => {
				return res.data;
			},
			(err: restClientCore.Errors.RestClientError) => {
				if (err && err.body && err.body.meta && err.body.meta.status === 404) {
					return null;
				}
				return Promise.reject(err);
			},
		);
	}
}
