import * as dt from "@akashic/server-engine-data-types";
/**
 * 起動リクエストキューに積むメッセージ
 */
export interface BootQueueMessage {
	/**
	 * 起動するインスタンスのID
	 */
	instanceId: string;
	/**
	 * 起動するゲームのコード
	 */
	gameCode: string;
	/**
	 * 起動するスクリプトのパス
	 */
	entryPoint: string;
	/**
	 * 起動場所選定に必要なコスト情報
	 */
	cost: number;
	/**
	 * ゲームにインジェクトするモジュール一覧
	 */
	modules: dt.InstanceModuleLike[];
	/**
	 * インスタンス割り当て先制約
	 */
	assignmentConstraints?: {
		/** 割り当て先プロセスの trait */
		trait: string[];
	};
	/**
	 * 割り当て先を強制指定する場合に指定するオプション
	 */
	forceAssignTo?: {
		/** 割り当て先ホスト名 */
		host: string;
		/** 割り当て先プロセス名 */
		name: string;
	};
}
