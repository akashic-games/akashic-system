import * as dt from "@akashic/server-engine-data-types";

/**
 * InstanceのSystem APIレスポンス用Entity
 */
export interface InstanceResponseLike {
	/**
	 * インスタンスのID
	 */
	id: string;
	/**
	 * 起動するゲーム識別子
	 */
	gameCode: string;
	/**
	 * instanceの状態
	 */
	status: string;
	/**
	 * このinstanceに指定されている各種モジュール情報
	 */
	modules: dt.InstanceModuleLike[];
	/**
	 * このinstanceの稼働先
	 */
	region: string;
	/**
	 * 終了コード
	 */
	exitCode?: number;
	/**
	 * 実行する js ファイルのパス
	 */
	entryPoint: string;
	/**
	 * 割り当てコスト
	 */
	cost: number;
	/**
	 * インスタンス稼働先のプロセス(game-runner)の識別子
	 */
	processName?: string;
}
