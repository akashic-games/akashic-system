import { ProcessClient } from "@akashic/cluster-monitor-api-client";
import { Request, Response } from "express";

export class SummaryController {
	private _client: ProcessClient;

	constructor(client: ProcessClient) {
		this._client = client;
	}

	public get(_req: Request, res: Response, next: Function) {
		this._client
			.getClusterSummary()
			.then((res) => res.data)
			.then((data) => {
				const json = JSON.stringify(data, null, "  ");
				return res.render("cluster", {
					cluster: data,
					json,
					jsonRows: json.split("\n").length + 1,
				});
			})
			.catch((error) => next(error));
	}
}
