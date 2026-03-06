import { AmqpConnectionManager } from "@akashic/amqp-utils";
import * as constants from "./constants";
import {
	InstanceRequestMessage,
	InstanceRequestMessageType,
	PauseInstanceRequestMessage,
	PauseInstanceRequestParameters,
	ResumeInstanceRequestMessage,
	ResumeInstanceRequestParameters,
	StartInstanceRequestMessage,
	StartInstanceRequestParameters,
	StopInstanceRequestMessage,
	StopInstanceRequestParameters,
} from "./messages";
import { setup } from "./setup";

export class InstanceRequestPublisher {
	private _amqpConnectionManager: AmqpConnectionManager;

	constructor(amqpConnectionManager: AmqpConnectionManager) {
		this._amqpConnectionManager = amqpConnectionManager;
	}

	public setup(): Promise<void> {
		return setup(this._amqpConnectionManager);
	}

	public requestStartInstance(instanceId: string, parameters?: StartInstanceRequestParameters): Promise<void> {
		const msg: StartInstanceRequestMessage = {
			instanceId,
			type: InstanceRequestMessageType.Start,
			parameters,
		};
		return this._publish(msg);
	}

	public requestStopInstance(instanceId: string, parameters?: StopInstanceRequestParameters): Promise<void> {
		const msg: StopInstanceRequestMessage = {
			instanceId,
			type: InstanceRequestMessageType.Stop,
			parameters,
		};
		return this._publish(msg);
	}

	public requestPauseInstance(instanceId: string, parameters?: PauseInstanceRequestParameters): Promise<void> {
		const msg: PauseInstanceRequestMessage = {
			instanceId,
			type: InstanceRequestMessageType.Pause,
			parameters,
		};
		return this._publish(msg);
	}

	public requestResumeInstance(instanceId: string, parameters?: ResumeInstanceRequestParameters): Promise<void> {
		const msg: ResumeInstanceRequestMessage = {
			instanceId,
			type: InstanceRequestMessageType.Resume,
			parameters,
		};
		return this._publish(msg);
	}

	private _publish<T>(msg: InstanceRequestMessage<T>): Promise<void> {
		return this._amqpConnectionManager.publishObject(constants.INSTANCE_REQUEST_EXCHANGE, msg.type, msg, {
			persistent: true,
			expiration: constants.INSTANCE_REQUEST_MESSAGE_TTL,
		});
	}
}
