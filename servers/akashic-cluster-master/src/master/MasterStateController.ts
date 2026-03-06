import * as express from "express";

export class MasterStateController {
	private _masterController: import("../core").MasterController;
	constructor(masterController: import("../core").MasterController) {
		this._masterController = masterController;
	}
	/**
	 * マスターかどうかを返す
	 * GET /v1.0/master/state
	 */
	public get(_req: express.Request, res: express.Response, _next: Function): any {
		res.json({ isMaster: this._masterController.isMaster });
	}
}
