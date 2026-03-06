import { context } from "@akashic-system/logger";
import * as activeRecord from "@akashic/akashic-active-record";
import * as dt from "@akashic/server-engine-data-types";
import { LogFactory } from "../../util/LogFactory";
import { Mutex } from "../../util/Mutex";
import { StatusUpdater } from "../../util/StatusUpdater";
import { BootQueueMessage } from "../queues/BootQueueMessage";
import { AssignmentResolver, ResolveResult, ResolverResult } from "./AssignmentResolver";
import { BootQueueExit } from "./BootQueueExit";

export class BootRequestConsumer {
	private _updater: StatusUpdater;
	private _logFactory: LogFactory;
	private _instanceRepository: activeRecord.Instance;
	private _requestIncoming: BootQueueExit;
	private _assignmentResolver: AssignmentResolver;
	private _mutex: Mutex;
	constructor(
		requestIncoming: BootQueueExit,
		assignmentResolver: AssignmentResolver,
		updater: StatusUpdater,
		logFactory: LogFactory,
		instanceRepository: activeRecord.Instance,
		mutex: Mutex,
	) {
		this._updater = updater;
		this._logFactory = logFactory;
		this._instanceRepository = instanceRepository;
		this._requestIncoming = requestIncoming;
		this._assignmentResolver = assignmentResolver;
		this._mutex = mutex;
	}
	public connect() {
		const log = this._logFactory.getLogger("out");
		this._requestIncoming.addListener("message", async (message) => {
			/**
			 * 現状無限リトライになってしまっているが、エラー時の処理が現状無いので、何とかしたいができてない
			 */
			while (true) {
				try {
					const result = await this._mutex.enterLockSection(message.instanceId, async () => {
						log.trace("ゲーム起動処理の開始", context({ instanceId: message.instanceId }));
						const instance = await this._instanceRepository.get(message.instanceId);
						if (instance.status !== dt.Constants.INSTANCE_STATE_PREPARE) {
							log.warn("instanceがprepare状態でない。処理中に終了処理が割り込んだ？", context({ instanceId: message.instanceId }));
							return null;
						}
						const result = await this._assignmentResolver.resolve(message);
						return await this.updateState(result);
					});
					// 割り当て完了をログに出す
					if (result) {
						log.info("割り当て処理が完了しました", context({ key: result.message.gameCode }));
					}
					break;
				} catch (error) {
					await this.catchUnknownAssignError(message, error);
				}
			}
		});
	}
	private updateState(result: ResolverResult): Promise<ResolverResult> {
		const log = this._logFactory.getLogger("out");
		switch (result.resolveResult) {
			case ResolveResult.SUCCESS:
				log.info("割り当てが完了したのでインスタンス状態を更新します", context({ instanceId: result.message.instanceId }));
				break;
			case ResolveResult.FAIL:
				log.warn("割り当て先が見つからなかったので、インスタンス状態を更新します", context({ instanceId: result.message.instanceId }));
				break;
			default:
				log.error(`不明な割り当て結果 ${result.resolveResult}`);
				break;
		}
		if (result.resolveResult === ResolveResult.SUCCESS) {
			const target = result.target;
			const processName = [target.fqdn.toReverseFQDN(), target.type, target.name].join(".");
			return this._updater
				.update(null, result.message.instanceId, dt.Constants.INSTANCE_STATE_RUNNING, undefined, processName)
				.then(() => result);
		} else {
			return this._updater
				.update(null, result.message.instanceId, dt.Constants.INSTANCE_STATE_ERROR, dt.Constants.INSTANCE_EXIT_CODE_SERVER_RESOURCE_FULL)
				.then(() => result);
		}
	}
	private catchUnknownAssignError(message: BootQueueMessage, error: any): Promise<void> {
		const log = this._logFactory.getLogger("out");
		log.error("割り当て処理中に未処理のエラーが発生しました", error);
		const errorCode = dt.Constants.INSTANCE_EXIT_CODE_FAILURE;
		const status = dt.Constants.INSTANCE_STATE_ERROR;
		return this._updater
			.update(null, message.instanceId, status, errorCode)
			.catch((err) => log.error("割り当て処理中の未処理エラーの処理中にエラーが発生しました", context({ error: err })));
	}
}
