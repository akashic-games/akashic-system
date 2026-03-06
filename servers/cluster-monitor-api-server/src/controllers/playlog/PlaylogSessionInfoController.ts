import restCommons = require("@akashic/akashic-rest-commons");
import * as Cast from "@akashic/cast-util";
import { Request, Response } from "express";

//
import type { RedisCommander } from "ioredis";

class PlaylogSessionInfoController {
	private _redis: RedisCommander;

	constructor(redis: RedisCommander) {
		this._redis = redis;
	}
	public get(req: Request, res: Response, next: Function): any {
		const sessionName: string = Cast.string(req.query.sessionName, undefined, false, "invalid session_name");
		const sessionSummaryKey: string = sessionName + "__session_summary";
		return this._redis
			.hgetall(sessionSummaryKey)
			.then((result: any) => {
				if (!result.reserved || !result.started) {
					throw new restCommons.Errors.NotFound(sessionSummaryKey + " not found");
				}
				return res.json({
					reserved: Number(result.reserved),
					started: Number(result.started),
				});
			})
			.catch((error) => next(error));
	}
}

export default PlaylogSessionInfoController;
