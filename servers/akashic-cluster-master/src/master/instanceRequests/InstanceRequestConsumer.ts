import { context } from "@akashic-system/logger";
import * as dt from "@akashic/server-engine-data-types";
import { LogFactory } from "../../util/LogFactory";
import { Mutex } from "../../util/Mutex";
import { StatusUpdater } from "../../util/StatusUpdater";
import { ProcessConnections } from "../connections/ProcessConnections";
import { InstanceAssignmentRepository } from "../repositories/InstanceAssignmentRepository";
import { InstanceRequestQueueExit } from "./InstanceRequestQueueExit";

export class InstanceRequestConsumer {
	private _logFactory: LogFactory;
	private _instanceAssignmentRepository: InstanceAssignmentRepository;
	private _processConnections: ProcessConnections;
	private _updater: StatusUpdater;
	private _requestIncoming: InstanceRequestQueueExit;
	private _mutex: Mutex;

	constructor(
		requestIncoming: InstanceRequestQueueExit,
		instanceAssignmentRepository: InstanceAssignmentRepository,
		processConnections: ProcessConnections,
		logFactory: LogFactory,
		mutex: Mutex,
		updater: StatusUpdater,
	) {
		this._logFactory = logFactory;
		this._instanceAssignmentRepository = instanceAssignmentRepository;
		this._processConnections = processConnections;
		this._updater = updater;
		this._requestIncoming = requestIncoming;
		this._mutex = mutex;
	}

	public connect() {
		const log = this._logFactory.getLogger("out");
		this._requestIncoming.addListener("message", async (item) => {
			/**
			 * 現状無限リトライになってしまっているが、エラー時の処理が現状無いので、何とかしたいができてない
			 */
			while (true) {
				try {
					const instanceId = await this._mutex.enterLockSection(item.instanceId, async () => {
						log.trace(`インスタンスリクエスト ${item.type} の開始`, context({ instanceId: item.instanceId }));
						await this.processRequest(item.type, item.instanceId, item.isErrorRecovery); // エラーリトライ時にはinstanceStatusを更新しない
						return item.instanceId;
					});
					// インスタンスリクエスト完了をログに出す
					log.info("インスタンスリクエスト処理が完了しました", context({ instanceId }));
					break;
				} catch (error) {
					log.error("インスタンスリクエスト処理中に未処理のエラーが発生しました", context({ error }));
				}
			}
		});
	}

	private async processRequest(type: string, instanceId: string, isErrorRecovery: boolean): Promise<dt.ClusterIdentity[]> {
		const log = this._logFactory.getLogger("out");
		const stoppedTargets: dt.ClusterIdentity[] = [];
		try {
			const instanceAssignments = await this._instanceAssignmentRepository.getByInstanceId(instanceId); // 割り当て中情報を取得する
			log.trace("対象割り当て数: " + instanceAssignments.length);
			const results: ([unknown, null] | [null, dt.ClusterIdentity])[] = await Promise.all(
				// 割り当て中のプロセスを取り出して、割り当て解除を実行する
				instanceAssignments.map(async (instanceAssignment): Promise<[unknown, null] | [null, dt.ClusterIdentity]> => {
					try {
						if (type === "shutdown") {
							await this.unassignInstance(instanceAssignment);
						} else if (type === "pause") {
							await this.pauseInstance(instanceAssignment);
						} else if (type === "resume") {
							await this.resumeInstance(instanceAssignment);
						} else {
							return [new Error(`unknown instance request type ${type}`), null];
						}
						return [null, instanceAssignment.targetIdentity];
					} catch (error) {
						return [error, null];
					}
				}),
			);
			// リクエスト処理中に起こったエラーをまとめる
			let lastError: any = null;
			for (const [error, identity] of results) {
				if (error !== null) {
					lastError = error;
				} else {
					stoppedTargets.push(identity);
				}
			}
			if (lastError !== null) {
				throw lastError;
			}
			if (!isErrorRecovery) {
				// リカバリ処理ではstatusを変更しない
				if (type === "shutdown") {
					// 終了状態にする
					await this._updater.update(null, instanceId, dt.Constants.INSTANCE_STATE_CLOSED, dt.Constants.INSTANCE_EXIT_CODE_OK);
				} else if (type === "pause") {
					// 一時停止状態にする
					await this._updater.update(null, instanceId, dt.Constants.INSTANCE_STATE_PAUSED);
				} else if (type === "resume") {
					// 動作中状態にする
					await this._updater.update(null, instanceId, dt.Constants.INSTANCE_STATE_RUNNING);
				}
			}
			log.trace("instance状態更新完了");
		} catch (error) {
			log.error(`リクエスト ${type} 処理中に未処理のエラーが発生しました`, context({ error }));
			if (
				!isErrorRecovery && // リカバリ処理ではstatusを変更しない
				type === "shutdown"
			) {
				// 何かエラーが起きたのでstatusをshutdown failにする
				await this._updater.update(null, instanceId, dt.Constants.INSTANCE_STATE_ERROR, dt.Constants.INSTANCE_EXIT_CODE_SHUTDOWN_FAIL);
			}
		}
		return stoppedTargets; // 最終的に停止に成功した対象一覧
	}

	/**
	 * task割り当ての解除指令を投げる。
	 */
	private unassignInstance(instanceAssignment: dt.InstanceAssignment): Promise<void> {
		const log = this._logFactory.getLogger("out", this.getInfoString(instanceAssignment));
		return this._processConnections
			.unassignInstance(instanceAssignment.targetIdentity, instanceAssignment.targetPort, instanceAssignment.instanceId)
			.then(() => this._instanceAssignmentRepository.remove(instanceAssignment))
			.then(() => log.info("割り当てを解除しました"))
			.catch((error) => {
				log.error("割り当ての解除に失敗しました", context({ error }));
				return Promise.reject(error);
			});
	}

	/**
	 * 実行一時停止指令を投げる。
	 */
	private pauseInstance(instanceAssignment: dt.InstanceAssignment): Promise<void> {
		const log = this._logFactory.getLogger("out", this.getInfoString(instanceAssignment));
		return this._processConnections
			.pauseInstance(instanceAssignment.targetIdentity, instanceAssignment.targetPort, instanceAssignment.instanceId)
			.then(() => log.trace("一時停止しました"))
			.catch((error) => {
				log.error("一時停止に失敗しました", context({ error }));
				return Promise.reject(error);
			});
	}

	/**
	 * 実行一時停止解除指令を投げる。
	 */
	private resumeInstance(instanceAssignment: dt.InstanceAssignment): Promise<void> {
		const log = this._logFactory.getLogger("out", this.getInfoString(instanceAssignment));
		return this._processConnections
			.resumeInstance(instanceAssignment.targetIdentity, instanceAssignment.targetPort, instanceAssignment.instanceId)
			.then(() => log.trace("一時停止解除しました"))
			.catch((error) => {
				log.error("一時停止解除に失敗しました", context({ error }));
				return Promise.reject(error);
			});
	}

	private getInfoString(instanceAssignment: dt.InstanceAssignment) {
		return {
			key: instanceAssignment.targetIdentity.getKeyString(),
			instanceId: instanceAssignment.instanceId,
		};
	}
}
