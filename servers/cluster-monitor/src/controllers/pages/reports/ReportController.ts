import { SystemApiClient } from "@akashic/system-api-client";
import { Request, Response } from "express";

export class ReportController {
	private _systemApiClient: SystemApiClient;

	constructor(systemApiClient: SystemApiClient) {
		this._systemApiClient = systemApiClient;
	}

	public get(req: Request, res: Response, next: Function) {
		return this._systemApiClient
			.findReports({
				condition: JSON.stringify({ report_type: "crash", _id: req.params.id }),
			})
			.then((res) => res.data)
			.then((data) => {
				const report = data.values[0];
				const json = JSON.stringify(report, null, "  ");
				return res.render("report", {
					report,
					json,
					jsonRows: json.split("\n").length + 1,
				});
			})
			.catch((error) => next(error));
	}
}
