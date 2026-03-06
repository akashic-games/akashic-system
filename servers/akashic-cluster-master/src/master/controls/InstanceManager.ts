import * as activeRecord from "@akashic/akashic-active-record";
import { StartInstanceRequestParameters } from "@akashic/instance-requester";
import * as dt from "@akashic/server-engine-data-types";
import * as errors from "../../errors";
import { CallbackPublisher } from "../../util/CallbackPublisher";
import { StatusUpdater } from "../../util/StatusUpdater";
import { BootQueueMessage } from "../queues/BootQueueMessage";
import { BootQueueEntry } from "./BootQueueEntry";
import { InstanceRequestQueueEntry } from "./InstanceRequestQueueEntry";
import { ILogger } from "@akashic-system/logger";

/**
 * ゲーム起動・終了処理を行うクラス
 */
export class InstanceManager {
	private _database: activeRecord.Database;
	private _bootQueueEntry: BootQueueEntry;
	private _instanceRequestQueueEntry: InstanceRequestQueueEntry;
	private _updater: StatusUpdater;
	private _statusPublisher: CallbackPublisher;
	#logger: ILogger;

	constructor(
		database: activeRecord.Database,
		bootQueueEntry: BootQueueEntry,
		shutdownQueueEntry: InstanceRequestQueueEntry,
		updater: StatusUpdater,
		statusPublisher: CallbackPublisher,
		logger: ILogger,
	) {
		this._database = database;
		this._bootQueueEntry = bootQueueEntry;
		this._instanceRequestQueueEntry = shutdownQueueEntry;
		this._updater = updater;
		this._statusPublisher = statusPublisher;
		this.#logger = logger;
	}

	/**
	 * インスタンスを起動させる準備をして起動キューに積む
	 */
	public boot(instanceId: string, params?: StartInstanceRequestParameters): Promise<dt.Instance> {
		return this._database.repositories.instance.get(instanceId).then((instance) => {
			if (!instance) {
				return Promise.reject(new errors.ApplicationError("instance not found", errors.ApplicationErrorCode.NOT_FOUND));
			}
			const message: BootQueueMessage = {
				instanceId: instance.id,
				gameCode: instance.gameCode,
				entryPoint: instance.entryPoint,
				cost: instance.cost,
				modules: instance.modules,
				assignmentConstraints: params ? params.assignmentConstraints : undefined,
				forceAssignTo: params ? params.forceAssignTo : undefined,
			};
			this._bootQueueEntry.enqueue(message);
			return Promise.resolve(instance);
		});
	}

	/**
	 * インスタンスを正常終了させる準備をして終了キューに積む
	 */
	public shutdown(instanceId: string): Promise<dt.Instance> {
		return this._database.transaction<dt.Instance>(async (conn) => {
			const instance = await this._database.repositories.instance.getWithLock(instanceId, conn);
			if (!instance) {
				throw new errors.ApplicationError("instance not found", errors.ApplicationErrorCode.NOT_FOUND);
			}
			switch (instance.status) {
				case dt.Constants.INSTANCE_STATE_CLOSED:
					this.#logger.warn(`instance state conflict. instance already closed. skip shutdown. instanceId: ${instanceId}`);
					return instance;
				// エラーのときはリカバリで残存タスクを再削除することを許可する
			}
			if (instance.status === dt.Constants.INSTANCE_STATE_ERROR) {
				return instance; // 削除リトライ時にはstatusを変更しない。
			}
			// closingに変更する
			await this._updater.updateByInstance(conn, instance, dt.Constants.INSTANCE_STATE_CLOSING).then(() => instance);
			// 終了キューに積む
			this._instanceRequestQueueEntry.enqueue({
				type: "shutdown",
				instanceId: instance.id,
				isErrorRecovery: instance.status === dt.Constants.INSTANCE_STATE_ERROR, // リカバリ時はtrue
			});
			return instance;
		});
	}

	/**
	 * インスタンスを異常終了させる準備をして終了キューに積む
	 *
	 * @param instanceId 終了させるインスタンスの ID
	 * @param notifyOnly true の場合、状態変更通知の送信のみ行う (game-runner へ終了リクエストを送らない)
	 * @param message インスタンスの終了メッセージ
	 */
	public abort(instanceId: string, notifyOnly?: boolean, message?: string): Promise<dt.Instance> {
		return this._database.transaction<dt.Instance>((conn) =>
			this._database.repositories.instance.getWithLock(instanceId, conn).then<dt.Instance>((instance) => {
				switch (instance.status) {
					case dt.Constants.INSTANCE_STATE_CLOSED:
					case dt.Constants.INSTANCE_STATE_CLOSING:
					case dt.Constants.INSTANCE_STATE_ERROR:
						return Promise.resolve(instance); // すでに何らかの形で終了済みのため、ここで処理を打ち切る
				}
				// エラーとしてstatusを変更して通知する
				return this._updater
					.updateByInstance(conn, instance, dt.Constants.INSTANCE_STATE_ERROR, dt.Constants.INSTANCE_EXIT_CODE_FAILURE, undefined, message)
					.then(() => {
						// キューに処理を積む
						if (!notifyOnly) {
							this._instanceRequestQueueEntry.enqueue({
								type: "shutdown",
								instanceId: instance.id,
								isErrorRecovery: true,
							});
						}
						return instance;
					});
			}),
		);
	}

	/**
	 * インスタンス実行一時停止リクエストをキューに積む
	 */
	public pause(instanceId: string): Promise<dt.Instance> {
		return this._database.repositories.instance.get(instanceId).then<dt.Instance>((instance) => {
			if (!instance) {
				return Promise.reject(new errors.ApplicationError("instance not found", errors.ApplicationErrorCode.NOT_FOUND));
			}
			if (instance.status !== dt.Constants.INSTANCE_STATE_PAUSING) {
				return Promise.reject(new errors.ApplicationError("instance state conflict", errors.ApplicationErrorCode.DATABASE_CONFLICT_ERROR));
			}
			// system API 側で行われた状態変更(INSTANCE_STATE_RUNNING -> INSTANCE_STATE_PAUSING)の通知をここで発火
			return this._statusPublisher.publishInstanceStateChangedEvent(instance, instance.status).then(() => {
				this._instanceRequestQueueEntry.enqueue({
					type: "pause",
					instanceId: instance.id,
					isErrorRecovery: false,
				});
				return instance;
			});
		});
	}

	/**
	 * インスタンス実行一時停止解除リクエストをキューに積む
	 */
	public resume(instanceId: string): Promise<dt.Instance> {
		return this._database.repositories.instance.get(instanceId).then<dt.Instance>((instance) => {
			if (!instance) {
				return Promise.reject(new errors.ApplicationError("instance not found", errors.ApplicationErrorCode.NOT_FOUND));
			}
			if (instance.status !== dt.Constants.INSTANCE_STATE_RESUMING) {
				return Promise.reject(new errors.ApplicationError("instance state conflict", errors.ApplicationErrorCode.DATABASE_CONFLICT_ERROR));
			}
			// system API 側で行われた状態変更(INSTANCE_STATE_PAUSED -> INSTANCE_STATE_RESUMING)の通知をここで発火
			return this._statusPublisher.publishInstanceStateChangedEvent(instance, instance.status).then(() => {
				this._instanceRequestQueueEntry.enqueue({
					type: "resume",
					instanceId: instance.id,
					isErrorRecovery: false,
				});
				return instance;
			});
		});
	}
}
