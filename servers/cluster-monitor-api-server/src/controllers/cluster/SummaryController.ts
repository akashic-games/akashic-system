import { Request, Response } from "express";
import { Cluster } from "../../repositories/Cluster";
import ErrorConverters = require("../../utils/ErrorConverters");

class SummaryController {
	private _cluster: Cluster;
	constructor(cluster: Cluster) {
		this._cluster = cluster;
	}
	public get(_req: Request, res: Response, next: Function): any {
		this._cluster
			.getSummary()
			.then(res.json)
			.catch((error) => ErrorConverters.restClientErrorToApiError(error))
			.catch((error) => next(error));
	}
}
export = SummaryController;
