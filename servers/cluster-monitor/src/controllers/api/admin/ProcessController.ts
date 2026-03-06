import { ProcessClient } from "@akashic/cluster-monitor-api-client";
import { Request, Response } from "express";

export class ProcessController {
	private _admin: boolean;
	private _client: ProcessClient;

	constructor(client: ProcessClient, admin: boolean) {
		this._client = client;
		this._admin = admin;
	}

	public post(req: Request, res: Response, _next: Function) {
		const processName = decodeURIComponent(req.params.processName);
		if (this._admin) {
			this._client.putProcessMethod(processName, "standby").then(() => {
				res.status(200).json({});
			});
		} else {
			res.status(500);
			res.json({
				error: "need admin",
			});
		}
	}

	public delete(req: Request, res: Response, _next: Function) {
		const processName = decodeURIComponent(req.params.processName);
		if (this._admin) {
			this._client.putProcessMethod(processName, "normal").then(() => {
				res.status(200).json({});
			});
		} else {
			res.status(500);
			res.json({
				error: "need admin",
			});
		}
	}
}
