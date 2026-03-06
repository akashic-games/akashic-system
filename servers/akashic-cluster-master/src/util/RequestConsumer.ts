import { AmqpConnectionManager } from "@akashic/amqp-utils";
import {
	InstanceRequestConsumer,
	InstanceRequestMessage,
	InstanceRequestMessageType,
	StartInstanceRequestParameters,
} from "@akashic/instance-requester";
import { ILogger } from "@akashic-system/logger";
import { InstanceManager } from "../master/controls/InstanceManager";
import { LogFactory } from "./LogFactory";

export class RequestConsumer {
	private _consumer: InstanceRequestConsumer;
	private _instanceManager: InstanceManager;
	private _logger: ILogger;

	constructor(amqpConnectionManager: AmqpConnectionManager, instanceManager: InstanceManager, logFactory: LogFactory) {
		this._logger = logFactory.getLogger("out");

		this._consumer = new InstanceRequestConsumer(amqpConnectionManager, async (msg) => await this._onRequest(msg));
		this._consumer.on("connect", () => {
			this._logger.info("instance request consumer connected.");
		});
		this._consumer.on("close", () => {
			this._logger.warn("instance request consumer disconnected.");
		});
		this._consumer.on("unhandledMessage", (cause: any) => {
			this._logger.warn(`can't handle instance request message, cause: ${cause}`);
		});

		this._instanceManager = instanceManager;
	}

	public async start(): Promise<void> {
		await this._consumer.start();
	}

	public async stop(): Promise<void> {
		await this._consumer.stop();
	}

	private async _onRequest(request: InstanceRequestMessage<any>): Promise<boolean> {
		if (request.type === InstanceRequestMessageType.Start) {
			const params = request.parameters as StartInstanceRequestParameters;
			await this._instanceManager.boot(request.instanceId, params);
		} else if (request.type === InstanceRequestMessageType.Stop) {
			await this._instanceManager.shutdown(request.instanceId);
		} else if (request.type === InstanceRequestMessageType.Pause) {
			await this._instanceManager.pause(request.instanceId);
		} else if (request.type === InstanceRequestMessageType.Resume) {
			await this._instanceManager.resume(request.instanceId);
		} else {
			this._logger.warn(`unknown instance request, instanceId: ${request.instanceId}, type: ${request.type}`);
		}

		return true;
	}
}
