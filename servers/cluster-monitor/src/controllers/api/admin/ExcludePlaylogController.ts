import { DispatchingRedis } from "@akashic/dispatching-core";
import { Request, Response } from "express";

export class ExcludePlaylogController {
	private _dispatchingRedis: DispatchingRedis;
	private _admin: boolean;

	constructor(dispatchingRedis: DispatchingRedis, admin: boolean) {
		this._dispatchingRedis = dispatchingRedis;
		this._admin = admin;
	}

	public post(req: Request, res: Response, _next: Function) {
		const processId = decodeURIComponent(req.params.processId);
		if (this._admin) {
			this._dispatchingRedis.addExcludeProcess(processId, req.params.trait).then(() => {
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
		const processId = decodeURIComponent(req.params.processId);
		if (this._admin) {
			this._dispatchingRedis.removeExcludeProcess(processId, req.params.trait).then(() => {
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
