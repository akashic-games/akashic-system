import * as dt from "@akashic/server-engine-data-types";
import * as errors from "../../errors";
import { ProcessRepository } from "../repositories/ProcessRepository";
import { ProcessMonitor } from "./ProcessMonitor";

/**
 * Processの受け入れ処理を行うクラス
 */
export class ProcessAcceptor {
	private _processRepository: ProcessRepository;
	private _monitor: ProcessMonitor;

	constructor(processRepository: ProcessRepository, monitor: ProcessMonitor) {
		this._processRepository = processRepository;
		this._monitor = monitor;
	}

	public accept(target: dt.ClusterIdentity, port: number, machineValues: any): Promise<dt.Process> {
		// AliveMonitorの情報を取得して、受け入れ申請のzookeeperとの照合を行う
		const knownClusterIdentity = this._monitor.resolveClusterIdentity(target);
		if (!knownClusterIdentity || !target.isSame(knownClusterIdentity)) {
			return Promise.reject(
				new errors.ApplicationError(
					"クラスタjoinしようとしたプロセスがzookeeper上に見つからないか、zxidが一致しませんでした。expect: " +
						target.czxid +
						" actual: " +
						(knownClusterIdentity ? knownClusterIdentity.czxid : "none"),
					errors.ApplicationErrorCode.CLUSTER_CONFLICT_ERROR,
				),
			);
		}
		const process = new dt.Process({
			clusterIdentity: target,
			port,
			machineValues,
		});
		return this._processRepository.saveOrUpdate(process);
	}
	public leave(target: dt.ClusterIdentity): Promise<void> {
		return this._processRepository.remove(target);
	}
}
