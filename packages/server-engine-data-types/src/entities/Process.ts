import Cast = require("@akashic/cast-util");
import ClusterIdentity = require("../valueobjects/ClusterIdentity");
import ProcessLike = require("./ProcessLike");
/**
 * クラスタに参加しているプロセス情報
 */
class Process implements ProcessLike {
	/**
	 * プロセスのIdentity
	 */
	get clusterIdentity(): ClusterIdentity {
		return this._clusterIdentity;
	}

	/**
	 * プロセスの待ち受けポート番号
	 */
	get port(): number {
		return this._port;
	}

	/**
	 * 報告されたマシン情報
	 */
	get machineValues(): any {
		return this._machineValues;
	}

	public static fromObject(obj: any): Process {
		if (!obj) {
			throw new TypeError("obj is not valid");
		}
		return new Process({
			clusterIdentity: ClusterIdentity.fromObject(obj.clusterIdentity),
			port: Cast.int(obj.port, false, "property port is not valid"),
			machineValues: obj.machineValues,
		});
	}
	private _clusterIdentity: ClusterIdentity;
	private _port: number;
	private _machineValues: any;

	constructor(args: ProcessLike) {
		this._clusterIdentity = new ClusterIdentity(args.clusterIdentity);
		this._port = args.port;
		this._machineValues = args.machineValues;
	}
}

export = Process;
