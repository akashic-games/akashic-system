import * as dt from "@akashic/server-engine-data-types";

/**
 * タスク割当先
 */
export class TaskAssignmentTarget {
	private _targetIdentity: dt.ClusterIdentity;
	private _targetPort: number;
	private _cost: number;
	/**
	 * 割当先の情報
	 */
	get targetIdentity() {
		return this._targetIdentity;
	}
	/**
	 * 割当先の待ち受けポート
	 */
	get targetPort() {
		return this._targetPort;
	}
	/**
	 * 割当先のコスト
	 */
	get cost() {
		return this._cost;
	}
	constructor(targetIdentity: dt.ClusterIdentity, targetPort: number, cost: number) {
		this._targetIdentity = targetIdentity;
		this._targetPort = targetPort;
		this._cost = cost;
	}
}
