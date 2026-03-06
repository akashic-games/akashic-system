import type * as redis from "ioredis";

import { AliveMonitoring } from "./AliveMonitoring";
import { Process, ProcessLike } from "..";

/**
 * Redis をバックエンドにした、 Alive Monitoring のハンドラ。
 *
 * process の trait を Key にした、Redis Hash を使う。
 * field にプロセスID、Value にそのプロセスの情報の JSON String。
 */
export class AliveMonitoringRedis implements AliveMonitoring {
	public static REDIS_KEY_PREFIX = "alive_process";
	private readonly redisClient: redis.RedisCommander;

	constructor(redisClient: redis.RedisCommander) {
		this.redisClient = redisClient;
	}

	public async findProcessByTrait(trait: string): Promise<ProcessLike[]> {
		const processJsonStrings = await this.redisClient.hgetall(AliveMonitoringRedis.resolveKeyName(trait));

		return Object.values(processJsonStrings).map((jsonString) => Process.fromObject(JSON.parse(jsonString)));
	}

	public async getProcess(trait: string, id: string): Promise<ProcessLike | null> {
		const processJsonString: string | null = await this.redisClient.hget(AliveMonitoringRedis.resolveKeyName(trait), id);

		if (processJsonString != null) {
			return Process.fromObject(JSON.parse(processJsonString));
		}
		return null;
	}

	public async joinProcess(process: ProcessLike): Promise<void> {
		await this.redisClient.hset(
			AliveMonitoringRedis.resolveKeyName(process.trait),
			process.id,
			JSON.stringify({
				id: process.id,
				trait: process.trait,
				endpoint: process.endpoint,
				numMaxClients: process.numMaxClients,
				reservationEndpoint: process.reservationEndpoint,
			}),
		);
	}

	public async leaveProcess(process: ProcessLike): Promise<void> {
		await this.redisClient.hdel(AliveMonitoringRedis.resolveKeyName(process.trait), process.id);
	}

	private static resolveKeyName(trait: string): string {
		return `${this.REDIS_KEY_PREFIX}:${trait}`;
	}
}
