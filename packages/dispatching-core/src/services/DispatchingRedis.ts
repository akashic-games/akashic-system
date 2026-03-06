import type * as Redis from "ioredis";
import { DispatchingDefinition } from "../definitions/DispatchingDefinition";
import { Capacity } from "../entities/Capacity";
import { CapacityLike } from "../entities/CapacityLike";
import { Process } from "../entities/Process";
import { ProcessLike } from "../entities/ProcessLike";
import { Dispatching } from "./Dispatching";

/**
 * WITHSCORE オプション使用時の MEMBER/SCORE リスト取得ヘルパ
 * - in:  ["m1", "1", "m2", "2", "m3", "3"]
 * - out: [{member: "m1", score: 1}, {member: "m2", score: 2}, {member: "m3", score: 3}]
 * リストが奇数の場合、最後の score 要素は除外される。
 */
export function toMemberWithScoreLike<T>(flatMemberAndScores: string[], instantiate: (input: { member: string; score: number }) => T): T[] {
	if (!flatMemberAndScores || 1 >= flatMemberAndScores.length) {
		return [];
	}
	const resultSize = (flatMemberAndScores.length / 2) | 0;
	const results = new Array<T>(resultSize);
	let i = 0;
	for (let out = 0; out < resultSize; ++out, i += 2) {
		results[out] = instantiate({ member: flatMemberAndScores[i], score: Number(flatMemberAndScores[i + 1]) });
	}
	return results;
}

export class DispatchingRedis implements Dispatching {
	private _repos: Redis.RedisCommander;

	constructor(redis: Redis.RedisCommander) {
		this._repos = redis;
	}

	/**
	 * プロセスの登録
	 * 既に該当キーが存在する場合は削除してから登録する。
	 * @note 通常プロセスの起動時は process.numDispatchedClients = 0 となる。
	 */
	public assignProcess(process: ProcessLike): Promise<void> {
		const key = this._createDispatchedClientsKey(process);
		return this._repos
			.zrem(key, process.id)
			.catch(() => Promise.resolve())
			.then(() => {
				return this._repos.zadd(key, process.numDispatchedClients, process.id).then<void>();
			});
	}

	/**
	 * キャパシティの登録
	 * 既に該当キーが存在する場合は削除してから登録する。
	 * @note 通常プロセスの起動時は capacity.capacity = numMaxClients となる。
	 */
	public assignCapacity(capacity: CapacityLike): Promise<void> {
		const key = this._createCapacityKey(capacity);
		return this._repos
			.zrem(key, capacity.processId)
			.catch(() => Promise.resolve())
			.then(() => {
				return this._repos.zadd(key, capacity.capacity, capacity.processId).then<void>();
			});
	}

	/**
	 * プロセスの登録解除
	 */
	public unassignProcess(process: ProcessLike): Promise<void> {
		const key = this._createDispatchedClientsKey(process);
		return this._repos.zrem(key, process.id).then<void>();
	}

	/**
	 * キャパシティの登録解除
	 */
	public unassignCapacity(capacity: CapacityLike): Promise<void> {
		const key = this._createCapacityKey(capacity);
		return this._repos.zrem(key, capacity.processId).then<void>();
	}

	/**
	 * 特徴・プレーID指定のプロセスを優先度順（= クライアント数昇順）で返す。
	 */
	public findProcesses(trait: string, playId: string): Promise<ProcessLike[]> {
		const key = this._createDispatchedClientsKey({ trait, playId });
		return this._repos.zrangebyscore(key, 0, "+inf", "WITHSCORES").then((values: string[]) => {
			return toMemberWithScoreLike(values, (input: { member: string; score: number }) => {
				return Process.fromObject({ id: input.member, trait, playId, numDispatchedClients: input.score });
			});
		});
	}

	/**
	 * 特徴・プレーID指定のプロセスを優先度順（= キャパシティ降順）で返す。
	 */
	public findCapacities(trait: string): Promise<CapacityLike[]> {
		const key = this._createCapacityKey({ trait });
		return this._repos.zrevrangebyscore(key, "+inf", 0, "WITHSCORES").then((values: string[]) => {
			return toMemberWithScoreLike(values, (input: { member: string; score: number }) => {
				return Capacity.fromObject({ processId: input.member, trait, capacity: input.score });
			});
		});
	}

	/**
	 * プロセスのクライアント割り当て数の増減
	 * increment が負数の場合は割り当て数を減じる操作となる。
	 */
	public async increaseClient(processId: string, trait: string, playId: string, increment: number): Promise<number> {
		const resultIncrement: string = await this._repos.zincrby(this._createDispatchedClientsKey({ trait, playId }), increment, processId);

		return parseInt(resultIncrement, 10);
	}

	/**
	 * プロセスのキャパシティの増減
	 * increment が負数の場合はキャパシティを減じる操作となる。
	 */
	public async increaseCapacity(processId: string, trait: string, increment: number): Promise<number> {
		const resultIncrement: string = await this._repos.zincrby(this._createCapacityKey({ trait }), increment, processId);

		return parseInt(resultIncrement, 10);
	}

	/**
	 * プロセスをクライアント割当の対象外にする
	 */
	public addExcludeProcess(processId: string, trait: string): Promise<number> {
		return this._repos.sadd(this._createExcludeProcessesKey(trait), processId);
	}

	/**
	 * プロセスをクライアント割当の対象外から除外する
	 */
	public removeExcludeProcess(processId: string, trait: string): Promise<number> {
		return this._repos.srem(this._createExcludeProcessesKey(trait), processId);
	}

	/**
	 * プロセスが割当対象外かを返す
	 */
	public async isExcludeProcesses(processId: string, trait: string): Promise<boolean> {
		return 1 === (await this._repos.sismember(this._createExcludeProcessesKey(trait), processId));
	}

	/**
	 * 割当対象外のプロセスID配列を返す
	 */
	public getExcludeProcesses(trait: string): Promise<string[]> {
		return this._repos.smembers(this._createExcludeProcessesKey(trait));
	}

	private _createDispatchedClientsKey(condition: { trait: string; playId: string }): string {
		return (
			DispatchingDefinition.DISPATCHED_CLIENTS_KEY +
			DispatchingDefinition.SEP +
			condition.trait +
			DispatchingDefinition.SEP +
			condition.playId
		);
	}

	private _createCapacityKey(condition: { trait: string }): string {
		return DispatchingDefinition.CAPACITY_NUM_CLIENTS_KEY + DispatchingDefinition.SEP + condition.trait;
	}

	private _createExcludeProcessesKey(trait: string): string {
		return DispatchingDefinition.EXCLUDE_PROCESSES_KEY + DispatchingDefinition.SEP + trait;
	}
}
