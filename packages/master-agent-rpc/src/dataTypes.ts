import * as dt from "@akashic/server-engine-data-types";

/**
 * 起動するゲームの情報
 */
export interface Game {
	/**
	 * ゲームコード
	 */
	gameCode: string;
	/**
	 * リビジョン
	 */
	revision: string;
	/**
	 * ゲーム画面の幅(出力ではなく、ゲーム上の値)
	 */
	width: number;
	/**
	 * ゲーム画面の高さ(出力ではなく、ゲーム上の値)
	 */
	height: number;
}

/**
 * クラスタに参加するための情報
 */
export interface ProcessInfo {
	/**
	 * クラスタ識別値
	 */
	clusterIdentity: dt.ClusterIdentityLike;
	/**
	 * masterから接続するポート番号
	 */
	port: number;
	/**
	 * masterに渡すマシン情報。json化可能な情報のみ送信可能
	 */
	machineValues: any;
}

/**
 * インスタンス稼働情報
 */
export interface InstanceAssignment {
	/**
	 * 稼働するインスタンスのID
	 */
	instanceId: string;
	/**
	 * インスタンスで稼働させるゲームのコード
	 */
	gameCode: string;
	/**
	 * インスタンスで稼働させるスクリプトのパス
	 */
	entryPoint: string;
	/**
	 * インスタンスにinjectするmodule一覧
	 */
	modules: dt.InstanceModuleLike[];
	/**
	 * インスタンスを稼動させるためのコスト (キャパシティ消費量)
	 */
	cost: number;
	/**
	 * インスタンスで稼働させるプレイのplayId
	 */
	playId: string;
	/**
	 * 最も親のプレイからインスタンスで稼働させるプレイの親プレイまでのplayIdのリスト
	 */
	parentPlayIds: string[];
}
