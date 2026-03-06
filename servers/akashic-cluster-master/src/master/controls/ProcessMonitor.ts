import { context } from "@akashic-system/logger";
import * as dt from "@akashic/server-engine-data-types";
import { LogFactory } from "../../util/LogFactory";
import { InstanceAssignmentRepository } from "../repositories/InstanceAssignmentRepository";
import { ProcessRepository } from "../repositories/ProcessRepository";
import { ErrorProcessor } from "./ErrorProcessor";

type Core = import("../../core").Core;
type MasterController = import("../../core").MasterController;
type Monitor = import("../../core").Monitor;

export class ProcessMonitor {
	private _monitor: Monitor;
	private _masterController: MasterController;
	private _processRepository: ProcessRepository;
	private _instanceAssignmentRepository: InstanceAssignmentRepository;
	private _errorProcessor: ErrorProcessor;
	private _logFactory: LogFactory;
	constructor(
		core: Core,
		processRepository: ProcessRepository,
		instanceAssignmentRepository: InstanceAssignmentRepository,
		errorProcessor: ErrorProcessor,
		logFactory: LogFactory,
	) {
		this._monitor = core.monitor;
		this._masterController = core.masterController;
		this._processRepository = processRepository;
		this._instanceAssignmentRepository = instanceAssignmentRepository;
		this._errorProcessor = errorProcessor;
		this._logFactory = logFactory;
	}
	public connect(): Promise<void> {
		const log = this._logFactory.getLogger("out");
		this._monitor.addListener("nodeJoined", (identity: dt.ClusterIdentity) =>
			log.trace("クラスタ参加検知", context({ key: identity.getKeyString() })),
		);
		this._monitor.addListener("error", (error: Error) => log.error("クラスタモニターでエラー", context({ error: String(error) })));
		this._monitor.addListener("nodeLeaved", async (identity: dt.ClusterIdentity) => {
			try {
				await this.nodeLeaved(identity);
			} catch (error) {
				log.error("nodeLeavedの処理でエラー", context({ error }));
				return;
			}
			log.info("クラスタ離脱を検知して処理しました", context({ key: identity.getKeyString() }));
		});
		return this._monitor.connect();
	}

	/**
	 * ProcessIdentityからclusterIdentityを取得する
	 */
	public resolveClusterIdentity(identity: dt.ProcessIdentityLike) {
		return this._monitor.resolveClusterIdentity(identity);
	}
	/**
	 * zookeeper(monitor)とmysqlとのズレを検知してnode終了処理を実施する
	 */
	public syncDatabase() {
		const log = this._logFactory.getLogger("out");
		log.trace("DBとZookeeperとの同期処理を実施します");
		// monitorで確認済みのidentitiesを取得
		const identities = this._monitor.getAllNodes();
		// processのidentitiesを取得
		log.trace(`稼働中のprocess数: ${identities.length}`);
		// DBから死亡processノード一覧を取得
		const deadProcessNodes = this._processRepository.getNotByIdentities(identities).then((processes) => {
			const identities = processes.map((p) => p.clusterIdentity);
			log.trace(`同期で検知した死亡プロセス数: ${identities.length}`);
			return identities;
		});
		// 死亡ノード一覧をくっつけて、nodeLeavedをコールする
		const doneLeave = Promise.all([deadProcessNodes])
			.then((identities) => identities.reduce<dt.ClusterIdentity[]>((prev, current) => prev.concat(current), []))
			.then((identities) => Promise.all(identities.map((identity) => this.nodeLeaved(identity))));
		// ゴミレコードを削除する
		return doneLeave
			.then(() => this.cleanDeadProcesses(identities))
			.then(() => this.cleanDeadInstanceAssignment(identities))
			.then(() => {
				log.trace("同期処理が完了しました");
			});
	}
	private nodeLeaved(node: dt.ClusterIdentity): Promise<void> {
		const log = this._logFactory.getLogger("out");
		if (!this._masterController.isMaster) {
			log.trace("nodeの離脱を検知したが、masterで無いので何もしない");
			return; // masterでないので何もしない
		}
		log.trace("nodeの離脱検知:", context({ key: node.getKeyString() }));
		return this.processLeaved(node).then(() =>
			log.trace("プロセスが離脱したので、離脱時の処理を実施しました", context({ key: node.getKeyString() })),
		);
	}
	private processLeaved(identity: dt.ClusterIdentity): Promise<void> {
		const log = this._logFactory.getLogger("out");
		return this._instanceAssignmentRepository
			.getByIdentity(identity)
			.then((instanceAssignments) =>
				Promise.all(
					instanceAssignments.map((instanceAssignment) => {
						switch (identity.type) {
							case dt.Constants.TYPE_GAME_RUNNER_2:
								return this._errorProcessor.processErrorReport(
									new dt.ProcessStatusInfo({
										instanceId: instanceAssignment.instanceId,
										type: dt.Constants.ProcessStatusType.INSTANCE_CRASHED,
										message: "game-runner2の離脱検知",
									}),
									true,
								);
							default:
								log.warn(`離脱時の処理内容が不明なプロセスの離脱を検知: ${identity.type}`);
								return;
						}
					}),
				),
			)
			.then(() => {
				return this._instanceAssignmentRepository.removeByIdentity(identity);
			})
			.then(() => this._processRepository.remove(identity));
	}
	private async cleanDeadProcesses(aliveProcesses: dt.ClusterIdentity[]): Promise<void> {
		const processes: dt.Process[] = await this._processRepository.getNotByIdentities(aliveProcesses);
		while (processes.length > 0) {
			const targetProcesses: dt.Process[] = processes.splice(0, 10); // 10件ずつまとめて削除する。あまり多いとクエリが長くなりすぎるし、少ないと時間がかかりすぎるので10件
			await this._processRepository.removeProcesses(targetProcesses.map((process) => process.clusterIdentity));
		}
	}
	private async cleanDeadInstanceAssignment(aliveProcesses: dt.ClusterIdentity[]): Promise<void> {
		const assignments: dt.InstanceAssignment[] = await this._instanceAssignmentRepository.getNotByIdentities(aliveProcesses);
		while (assignments.length > 0) {
			const targetAssignments: dt.InstanceAssignment[] = assignments.splice(0, 10); // 10件ずつまとめて削除する。あまり多いとクエリが長くなりすぎるし、少ないと時間がかかりすぎるので10件
			await this._instanceAssignmentRepository.removeByIdentities(targetAssignments.map((assignment) => assignment.targetIdentity));
		}
	}
}
