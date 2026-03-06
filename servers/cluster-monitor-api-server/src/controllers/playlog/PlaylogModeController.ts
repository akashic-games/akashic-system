import restCommons = require("@akashic/akashic-rest-commons");
import * as Cast from "@akashic/cast-util";
import { Request, Response } from "express";
import { excludeRedisKey } from "./PlaylogRedisKey";

//
import type { RedisCommander } from "ioredis";

const playlogModes: string[] = ["normal", "standby"];

class PlaylogModeController {
	private _redis: RedisCommander;
	constructor(redis: RedisCommander) {
		this._redis = redis;
	}
	public put(req: Request, res: Response, next: Function): any {
		let reqBody: { sessionName: string; mode: string };
		try {
			reqBody = {
				sessionName: Cast.string(req.body.sessionName, undefined, false, "invalid session_name"),
				mode: Cast.string(req.body.mode, undefined, false, "invalid mode"),
			};
		} catch (error) {
			return next(new restCommons.Errors.InvalidParameter("invalid parameter", error));
		}

		if (playlogModes.indexOf(reqBody.mode) < 0) {
			return next(new restCommons.Errors.InvalidParameter("invalid parameter", new RangeError("invalid mode")));
		}

		if (reqBody.mode === "standby") {
			return this._redis
				.sadd(excludeRedisKey, reqBody.sessionName)
				.then(() => res.json({ sessionName: reqBody.sessionName, mode: reqBody.mode }))
				.catch((error) => next(error));
		} else if (reqBody.mode === "normal") {
			return this._redis
				.srem(excludeRedisKey, reqBody.sessionName)
				.then(() => res.json({ sessionName: reqBody.sessionName, mode: reqBody.mode }))
				.catch((error) => next(error));
		}
	}
}

export default PlaylogModeController;
