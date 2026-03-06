import { ProcessLike } from "..";

export interface ReadOnlyAliveMonitoring {
	/**
	 * 特徴指定のプロセスの検索
	 * usage:
	 * findProcessByTrait(AliveMonitoringDefinition.ZNODE_TRAITS_STANDARD_WEBSOCKET)
	 *   .then(processes => {}) // 標準的な機能のWebsocketプロトコル対応プロセス
	 */
	findProcessByTrait(trait: string): Promise<ProcessLike[]>;

	/**
	 * プロセスの取得
	 *
	 * 見つからなかった場合は Null
	 */
	getProcess(trait: string, id: string): Promise<ProcessLike | null>;
}

export interface AliveMonitoring extends ReadOnlyAliveMonitoring {
	/**
	 * プロセスのクラスタ参加
	 */
	joinProcess(process: ProcessLike): Promise<void>;

	/**
	 * プロセスのクラスタ離脱
	 */
	leaveProcess(process: ProcessLike): Promise<void>;
}
