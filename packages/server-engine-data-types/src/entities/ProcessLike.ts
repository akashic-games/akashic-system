import ClusterIdentityLike = require("../valueobjects/ClusterIdentityLike");
/**
 * プロセス情報を表すinterface
 */
interface ProcessLike {
	/**
	 * プロセスのIdentity
	 */
	clusterIdentity: ClusterIdentityLike;
	/**
	 * プロセスの待ち受けポート番号
	 */
	port: number;
	/**
	 * 報告されたマシン情報
	 */
	machineValues: any;
}
export = ProcessLike;
