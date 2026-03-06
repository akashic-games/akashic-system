import { Errors } from "@akashic/akashic-rest-commons";
import * as cast from "@akashic/cast-util";
import { LogUtil } from "@akashic/log-util";
import { Request, Response } from "express";
import * as log4js from "log4js";
import { performance } from "perf_hooks";
import { SessionManager } from "../SessionManager";

export class DispatchedPlaysController {
	private _sessionManager: SessionManager;
	constructor(sessionManager: SessionManager) {
		this._sessionManager = sessionManager;
	}
	public post(req: Request, res: Response, next: Function): any {
		const logger = new LogUtil(log4js.getLogger("out"));
		const startTime = performance.now();
		try {
			const playId = cast.string(req.params.playId, 64, false, "invalid playId parameter");
			const playToken = cast.string(req.body.playToken, 64, false, "invalid playToken parameter");

			this._sessionManager.reserve(playId, playToken);
			const sessionManagerReservedTime = performance.now() - startTime;
			if (sessionManagerReservedTime > 1000) {
				logger.warn(`session manager reserved time: ${sessionManagerReservedTime} ms. playId: ${playId}`);
			}
			res.json(req.body);
			const dispatchedPlaysResponseTime = performance.now() - startTime;
			if (dispatchedPlaysResponseTime > 1000) {
				logger.warn(`dispatched plays response time: ${dispatchedPlaysResponseTime} ms. playId: ${playId}`);
			}
		} catch (error) {
			return next(new Errors.InvalidParameter("invalid parameter", error));
		}
	}
}

export class SessionsController {
	private _sessionManager: SessionManager;
	constructor(sessionManager: SessionManager) {
		this._sessionManager = sessionManager;
	}
	public get(req: Request, res: Response, next: Function): any {
		res.json(this._sessionManager.sessions());
	}
}
