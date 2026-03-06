import { ReadOnlyAliveMonitoring, ProcessLike, ZNODE_TRAITS_STANDARD_WEBSOCKET } from "@akashic/alive-monitoring-core";
import { Request, Response } from "express";
import { excludeRedisKey } from "../playlog/PlaylogRedisKey";

//
import type { RedisCommander } from "ioredis";

interface PlaylogServerHostInfo {
	host: string;
	normalCount: number;
	standbyCount: number;
}

class PlaylogServerHostsController {
	private _aliveMonitoring: ReadOnlyAliveMonitoring;
	private _redis: RedisCommander;

	constructor(aliveMonitoring: ReadOnlyAliveMonitoring, redis: RedisCommander) {
		this._aliveMonitoring = aliveMonitoring;
		this._redis = redis;
	}

	public get(_req: Request, res: Response, next: Function): void {
		this._aliveMonitoring
			.findProcessByTrait(ZNODE_TRAITS_STANDARD_WEBSOCKET)
			.then((servers) => this._createResponse(servers))
			.then((response) => res.json({ values: response }))
			.catch((error) => next(error));
	}

	private _countEachHostStandbyProcesses(servers: ProcessLike[], excludedServers: string[]): Map<string, number> {
		const excludedServersId = new Set<string>(excludedServers);
		const eachHostStandbyProcessCount = new Map<string, number>();
		servers.forEach((server): void => {
			if (excludedServersId.has(server.id)) {
				const host = server.id.split("_")[0];
				eachHostStandbyProcessCount.set(host, (eachHostStandbyProcessCount.get(host) || 0) + 1);
			}
		});
		return eachHostStandbyProcessCount;
	}

	private async _createResponse(servers: ProcessLike[]): Promise<PlaylogServerHostInfo[]> {
		const eachHostAllProcessCount = new Map<string, number>();
		servers.forEach((server): void => {
			const host = server.id.split("_")[0];
			eachHostAllProcessCount.set(host, (eachHostAllProcessCount.get(host) || 0) + 1);
		});

		const excludedServers = await this._redis.smembers(excludeRedisKey);
		const eachHostStandbyProcessCount: Map<string, number> = this._countEachHostStandbyProcesses(servers, excludedServers);

		const results: PlaylogServerHostInfo[] = [];
		eachHostAllProcessCount.forEach((allProcessesCount, host): void => {
			const standbyCount: number = eachHostStandbyProcessCount.get(host) || 0;
			const normalCount: number = allProcessesCount - standbyCount;
			results.push({ host, normalCount, standbyCount });
		});
		return results;
	}
}

export default PlaylogServerHostsController;
