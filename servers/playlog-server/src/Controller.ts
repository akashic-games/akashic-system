import { Errors } from "@akashic/akashic-rest-commons";
import * as cast from "@akashic/cast-util";
import { Request, Response } from "express";

import { SessionManager } from "./SessionManager";

export class DispatchedPlaysController {
	private _sessionManager: SessionManager;
	constructor(sessionManager: SessionManager) {
		this._sessionManager = sessionManager;
	}
	public post(req: Request, res: Response, next: Function): any {
		try {
			const playId = cast.string(req.body.playId, 64, false, "invalid playId parameter");
			const playToken = cast.string(req.body.playToken, 64, false, "invalid playToken parameter");

			this._sessionManager.reserve(playId, playToken);
			res.json(req.body);
		} catch (error) {
			return next(new Errors.InvalidParameter("invalid parameter", error));
		}
	}
}
