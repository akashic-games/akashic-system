import { SystemApiClient } from "@akashic/system-api-client";
import { InstanceClient } from "@akashic/system-control-api-client";
import { Request, Response } from "express";

export class InstanceController {
	private _systemApiClient: SystemApiClient;
	private _instanceClient: InstanceClient;

	constructor(systemApiClient: SystemApiClient, instanceClient: InstanceClient) {
		this._systemApiClient = systemApiClient;
		this._instanceClient = instanceClient;
	}

	public get(req: Request, res: Response, next: Function) {
		Promise.all([
			this._instanceClient.getInstance(req.params.id),
			this._systemApiClient.findReports({
				condition: JSON.stringify({ report_type: "crash", instanceId: req.params.id }),
			}),
		])
			.then((result) => {
				const instance = result[0].data;
				const json = JSON.stringify(instance, null, "  ");
				return res.render("instance", {
					instance,
					json,
					admin: true,
					jsonRows: json.split("\n").length + 1,
				});
			})
			.catch((error) => next(error));
	}
}
