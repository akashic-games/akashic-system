import { ProcessClient, Process } from "@akashic/cluster-monitor-api-client";
import { Request, Response } from "express";

interface ProcessOverview extends Process {
	isNormal: boolean;
	formattedTrait: string;
}
export class ProcessController {
	private _client: ProcessClient;

	constructor(client: ProcessClient) {
		this._client = client;
	}

	public get(req: Request, res: Response, next: Function) {
		this._client
			.getProcess(req.params.name)
			.then((res) => res.data)
			.then((data) => {
				const json = JSON.stringify(data, null, "  ");
				const processOverview: ProcessOverview = {
					...data,
					isNormal: data.mode === "normal",
					formattedTrait: data.trait.join(","),
				};
				return res.render("process", {
					process: processOverview,
					json,
					jsonRows: json.split("\n").length + 1,
				});
			})
			.catch((error) => next(error));
	}
}
