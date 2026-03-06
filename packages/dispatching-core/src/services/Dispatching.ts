import { CapacityLike } from "../entities/CapacityLike";
import { ProcessLike } from "../entities/ProcessLike";

export interface Dispatching {
	/**
	 * プロセスの登録
	 */
	assignProcess(process: ProcessLike): Promise<void>;

	/**
	 * キャパシティの登録
	 */
	assignCapacity(capacity: CapacityLike): Promise<void>;

	/**
	 * プロセスの登録解除
	 */
	unassignProcess(process: ProcessLike): Promise<void>;

	/**
	 * キャパシティの登録解除
	 */
	unassignCapacity(capacity: CapacityLike): Promise<void>;

	/**
	 * 特徴・プレーID指定のプロセスを優先度順（= クライアント数昇順）で返す。
	 */
	findProcesses(trait: string, playId: string): Promise<ProcessLike[]>;

	/**
	 * 特徴・プレーID指定のプロセスを優先度順（= キャパシティ降順）で返す。
	 */
	findCapacities(trait: string): Promise<CapacityLike[]>;

	/**
	 * プロセスのクライアント割り当て数の増減
	 * 増減後の割り当て数を返す。
	 * increment が負数の場合は割り当て数を減じる操作となる。
	 */
	increaseClient(processId: string, trait: string, playId: string, increment: number): Promise<number>;

	/**
	 * プロセスのキャパシティの増減
	 * 増減後のキャパシティを返す。
	 * increment が負数の場合はキャパシティを減じる操作となる。
	 */
	increaseCapacity(processId: string, trait: string, increment: number): Promise<number>;

	/**
	 * プロセスをクライアント割当の対象外にする
	 */
	addExcludeProcess(processId: string, trait: string): Promise<number>;

	/**
	 * プロセスをクライアント割当の対象外から除外する
	 */
	removeExcludeProcess(processId: string, trait: string): Promise<number>;

	/**
	 * プロセスが割当対象外かを返す
	 */
	isExcludeProcesses(processId: string, trait: string): Promise<boolean>;

	/**
	 * 割当対象外のプロセスID配列を返す
	 */
	getExcludeProcesses(trait: string): Promise<string[]>;
}
