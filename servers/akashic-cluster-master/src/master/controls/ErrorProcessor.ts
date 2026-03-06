import * as activeRecord from "@akashic/akashic-active-record";
import * as dt from "@akashic/server-engine-data-types";
import * as errors from "../../errors";
import { CallbackPublisher } from "../../util/CallbackPublisher";
import { InstanceManager } from "./InstanceManager";

type MasterController = import("../../core").MasterController;

export class ErrorProcessor {
	private _instanceManager: InstanceManager;
	private _instanceRepository: activeRecord.Instance;
	private _masterController: MasterController;
	private _publisher: CallbackPublisher;
	constructor(
		instanceManager: InstanceManager,
		instanceRepository: activeRecord.Instance,
		masterController: MasterController,
		publisher: CallbackPublisher,
	) {
		this._instanceManager = instanceManager;
		this._instanceRepository = instanceRepository;
		this._masterController = masterController;
		this._publisher = publisher;
	}
	/**
	 * エラーレポートを処理する
	 *
	 * @param errorReport エラー内容
	 * @param notifyOnly true の場合、状態変更通知の送信のみ行う (game-runner へ終了リクエストを送らない)
	 */
	public processErrorReport(errorReport: dt.ProcessStatusInfo, notifyOnly?: boolean): Promise<void> {
		switch (errorReport.type) {
			case dt.Constants.ProcessStatusType.INSTANCE_CRASHED:
			case dt.Constants.ProcessStatusType.INFINITY_LOOP_DETECTED:
				return this._instanceManager.abort(errorReport.instanceId, notifyOnly, errorReport.message).then<void>(() => undefined);
			case dt.Constants.ProcessStatusType.VIDEO_STOPPED:
				return this.publishVideoErrorEvent(errorReport.instanceId, errorReport.message);
		}
	}
	private publishVideoErrorEvent(instanceId: string, message?: string): Promise<void> {
		return this._instanceRepository
			.get(instanceId)
			.then<dt.Instance>((instance) => {
				if (!this._masterController.isMaster) {
					return Promise.reject(
						new errors.ApplicationError("target is not master", errors.ApplicationErrorCode.NOT_MASTER_ERROR), // マスターでないのでerrorを投げる
					);
				}
				return instance;
			})
			.then((instance) =>
				this._publisher.publishInstanceErrorEvent(instance.id, dt.Constants.INSTANCE_EXIT_CODE_VIDEO_PUBLISH_ERROR, message),
			);
	}
}
