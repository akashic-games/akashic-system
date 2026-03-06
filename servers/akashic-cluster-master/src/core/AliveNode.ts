import * as dt from "@akashic/server-engine-data-types";
/**
 * クラスタ上のプロセス
 */
export class AliveNode {
	private _clusterIdentity: dt.ClusterIdentity;
	private _zPath: string;

	/**
	 * プロセス情報
	 */
	get identity() {
		return this._clusterIdentity;
	}
	/**
	 * zookeeper上でのプロセスの生存ノードを表すパス
	 */
	get zPath() {
		return this._zPath;
	}

	constructor(identity: dt.ProcessIdentityLike, zPath: string, czxid: string) {
		this._clusterIdentity = dt.ClusterIdentity.fromProcessAndCzxid(identity, czxid);
		this._zPath = zPath;
	}
}
