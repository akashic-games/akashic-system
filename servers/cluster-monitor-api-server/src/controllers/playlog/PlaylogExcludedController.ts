import { Request, Response } from "express";
import { excludeRedisKey } from "./PlaylogRedisKey";

//
import type { RedisCommander } from "ioredis";

class PlaylogExcludedController {
	private _redis: RedisCommander;

	constructor(redis: RedisCommander) {
		this._redis = redis;
	}
	public get(_req: Request, res: Response, next: Function): any {
		return this._redis
			.smembers(excludeRedisKey)
			.then((result: any) => res.json({ result }))
			.catch((error) => next(error));
	}
}

export default PlaylogExcludedController;
