import * as dt from "@akashic/server-engine-data-types";
/**
 * 割り当て計算用の、インスタンスの割り当て状況オブジェクト
 */
export class InstanceAssignmentStatus {
	private _identity: dt.ClusterIdentity;
	private _assigned: number;
	get identity() {
		return this._identity;
	}
	get assigned() {
		return this._assigned;
	}
	constructor(identity: dt.ClusterIdentity, assigned: number) {
		this._identity = identity;
		this._assigned = assigned;
	}
}
