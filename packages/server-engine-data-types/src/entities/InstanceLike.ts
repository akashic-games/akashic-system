import { InstanceModuleLike } from "./InstanceModuleLike";

/**
 * インスタンスの情報
 */
interface InstanceLike {
	/**
	 * インスタンスのID
	 */
	id?: string;

	/**
	 * 起動するゲーム
	 */
	gameCode: string;

	/**
	 * instanceの状態
	 */
	status: string;

	/**
	 * このinstanceの稼働先
	 */
	region: string;

	/**
	 * 終了コード
	 */
	exitCode?: number;

	/**
	 * このinstanceのループの動作モード
	 */
	modules: InstanceModuleLike[];

	/**
	 * 割り当てコスト
	 */
	cost: number;

	/**
	 * インスタンス稼働先のプロセス(game-runner)の識別子
	 */
	processName?: string;

	/**
	 * 実行する js ファイルのパス
	 */
	entryPoint: string;
}

export = InstanceLike;
