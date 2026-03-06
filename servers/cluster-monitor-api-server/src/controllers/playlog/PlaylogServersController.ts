import restCommons = require("@akashic/akashic-rest-commons");
import { ReadOnlyAliveMonitoring, ProcessLike, ZNODE_TRAITS_STANDARD_WEBSOCKET } from "@akashic/alive-monitoring-core";
import * as Cast from "@akashic/cast-util";
import { Request, Response } from "express";
import { excludeRedisKey } from "./PlaylogRedisKey";

//
import type { RedisCommander } from "ioredis";

interface SessionInfo {
	reserved: number;
	started: number;
}

interface PlaylogServerInfo extends ProcessLike {
	mode?: "normal" | "standby";
	session?: SessionInfo;
}

class PlaylogServersController {
	private _aliveMonitoring: ReadOnlyAliveMonitoring;
	private _redis: RedisCommander;

	constructor(aliveMonitoring: ReadOnlyAliveMonitoring, redis: RedisCommander) {
		this._aliveMonitoring = aliveMonitoring;
		this._redis = redis;
	}

	public get(req: Request, res: Response, next: Function): void {
		let trait: string;
		let hostname: string;
		try {
			trait = Cast.string(req.query.trait, undefined, true, "invalid trait");
			hostname = Cast.string(req.query.hostname, undefined, true, "invalid hostname");
		} catch (error) {
			return next(new restCommons.Errors.InvalidParameter("invalid parameter", error));
		}
		this._aliveMonitoring
			.findProcessByTrait(trait || ZNODE_TRAITS_STANDARD_WEBSOCKET)
			.then((servers) => servers.filter((server) => (hostname ? server.id.startsWith(hostname + "_") : true)))
			.then((filtered) => this._createResponse(filtered))
			.then((response) => res.json({ values: response }))
			.catch((error) => next(error));
	}

	private async _getSessionInfo(id: string): Promise<SessionInfo | undefined> {
		const info = await this._redis.hgetall(id + "__session_summary");
		if (typeof info.reserved !== "string" || typeof info.started !== "string") {
			return undefined;
		}

		return {
			reserved: Number(info.reserved),
			started: Number(info.started),
		};
	}

	private async _createResponse(servers: ProcessLike[]): Promise<PlaylogServerInfo[]> {
		const results: PlaylogServerInfo[] = [];
		const excludedServers = await this._redis.smembers(excludeRedisKey);
		for (let i = 0; i < servers.length; ++i) {
			const server = servers[i];
			const data: PlaylogServerInfo = {
				id: server.id,
				trait: server.trait,
				endpoint: server.endpoint,
				numMaxClients: server.numMaxClients,
				reservationEndpoint: server.reservationEndpoint,
				mode: excludedServers.indexOf(server.id) === -1 ? "normal" : "standby",
				session: await this._getSessionInfo(server.id),
			};
			results.push(data);
		}
		return results;
	}
}

export default PlaylogServersController;
