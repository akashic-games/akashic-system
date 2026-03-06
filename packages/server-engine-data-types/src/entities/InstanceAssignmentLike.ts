import ClusterIdentityLike = require("../valueobjects/ClusterIdentityLike");
import { InstanceModuleLike } from "./InstanceModuleLike";

/**
 * masterがゲームの割り当て情報をprocessとやりとりする/した情報
 */
interface InstanceAssignmentLike {
	id?: string;
	/**
	 * 割り当てられたターゲット
	 */
	targetIdentity: ClusterIdentityLike;
	/**
	 * 割り当てられたターゲットの待ち受けポート
	 */
	targetPort: number;
	/**
	 * 割り当てられたインスタンスのID
	 */
	instanceId: string;
	/**
	 * 割り当てられたゲームのコード
	 */
	gameCode: string;
	/**
	 * 実行スクリプトのパス
	 */
	entryPoint: string;
	/**
	 * 割り当て量
	 */
	requirement: number;
	/**
	 * 稼働しているモジュール
	 */
	modules: InstanceModuleLike[];
}
export = InstanceAssignmentLike;
