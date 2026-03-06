import { InstanceClient } from "@akashic/system-control-api-client";
import { Request, Response } from "express";

export class DeleteInstanceController {
	private _client: InstanceClient;
	private _admin: boolean;

	constructor(instanceClient: InstanceClient, admin: boolean) {
		this._client = instanceClient;
		this._admin = admin;
	}

	public get(req: Request, res: Response, next: Function) {
		if (this._admin) {
			this._client
				.deletetInstance(req.params.id)
				.then(res.json)
				.catch((error) => next(error));
		} else {
			res.status(500);
			res.json({
				error: "need admin",
			});
		}
	}
}
