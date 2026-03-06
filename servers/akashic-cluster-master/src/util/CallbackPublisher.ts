import { context } from "@akashic-system/logger";
import * as callback from "@akashic/callback-publisher";
import * as dt from "@akashic/server-engine-data-types";
import { LogFactory } from "./LogFactory";

export class CallbackPublisher {
	private _publisher: callback.Publisher;
	private _logFactory: LogFactory;

	constructor(publisher: callback.Publisher, logFactory: LogFactory) {
		this._publisher = publisher;
		this._logFactory = logFactory;
	}

	public publishInstanceStateChangedEvent(instance: dt.Instance, status: string): Promise<void> {
		return this.publishInstanceStateChanged(this.createCallbackInstance(instance, status));
	}

	public publishInstanceStateChangedEventByInstanceIdAndPlayId(
		instanceId: string,
		playId: string,
		status: string,
		exitCode?: number,
	): Promise<void> {
		return this.publishInstanceStateChanged(this.createCallbackInstanceFromInstanceIdAndPlayId(instanceId, playId, status, exitCode));
	}

	public publishInstanceErrorEvent(instanceId: string, code: number, message?: string) {
		const log = this._logFactory.getLogger("out");
		log.trace("インスタンスの異常を通知します", context({ instanceId }));
		const errorDescription = new Error(`instance(${instanceId}) stopped because of error. ${message}`).stack;
		const error: callback.InstanceError = {
			instanceId,
			code,
			description:
				errorDescription.length > 1024
					? errorDescription.substring(0, 1021) + "..." // 1024文字に省略
					: errorDescription,
		};
		const event = new callback.Event<callback.InstanceError>({
			category: callback.EventCategory.Error,
			type: dt.Constants.EVENT_HANDLER_TYPE_ERROR,
			payload: error,
		});
		return this._publisher.publish(dt.Constants.EVENT_HANDLER_TYPE_ERROR, event).then(() => {
			return;
		});
	}

	private createCallbackInstance(value: dt.Instance, status: string): callback.Instance {
		const statusChanged: callback.Instance = {
			instanceId: value.id,
			status,
			description: "instance(" + value.id + ") status changed: " + status,
		};
		if (value.exitCode) {
			statusChanged.exitCode = value.exitCode;
		}
		return statusChanged;
	}

	private createCallbackInstanceFromInstanceIdAndPlayId(instanceId: string, playId: string, status: string, exitCode?: number) {
		const statusChanged: callback.Instance = {
			playId,
			instanceId,
			status,
		};
		if (exitCode) {
			statusChanged.exitCode = exitCode;
		}
		return statusChanged;
	}

	private publishInstanceStateChanged(instance: callback.Instance): Promise<void> {
		const event = new callback.Event<callback.Instance>({
			category: callback.EventCategory.Info,
			type: dt.Constants.EVENT_HANDLER_TYPE_INSTANCE_STATUS,
			payload: instance,
		});
		const log = this._logFactory.getLogger("out");
		log.trace("インスタンス状態の変更を通知します", context({ playId: instance.playId, instanceId: instance.instanceId }));
		return this._publisher.publish(dt.Constants.EVENT_HANDLER_TYPE_INSTANCE_STATUS, event).then<void>(() => {
			return;
		});
	}
}
