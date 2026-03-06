import { LoggerAware } from "@akashic-system/logger";
import { Database } from "@akashic/akashic-active-record";
import { Event } from "@akashic/callback-publisher";
import { CallbackClient } from "../../callback/CallbackClient";

export class InstanceNotification extends LoggerAware {
	private callbackClient: CallbackClient;
	private database: Database;

	constructor(database: Database) {
		super();
		this.database = database;
		this.callbackClient = new CallbackClient();
	}

	public async fire<T>(instanceId: string, eventName: string, content: Event<T>, warn: () => void): Promise<void> {
		return this.database.repositories.instanceEventHandler.getByInstanceId(instanceId, eventName).then((handlers) => {
			if (handlers.length > 0) {
				(async () => {
					await Promise.allSettled(
						handlers.map((handler) => {
							// MQへpostするNicoqの特定イベントをログに出力する
							if (
								"ExternalModuleRequest" === (content.payload as any)?.type &&
								"Nicoq" === (content.payload as any)?.data?.module &&
								"postLiveqResult" === (content.payload as any)?.data?.operation
							) {
								this.logger.info(`instanceId: ${instanceId}: POST to ${handler.endpoint} with ${JSON.stringify(content)}`);
							}

							return this.callbackClient.post(handler.endpoint, content).catch((err) => {
								this.logger.warn(`instanceId: ${instanceId}: POST to ${handler.endpoint} with ${JSON.stringify(content)} failed: `, err);
							});
						}),
					);
				})();
			} else {
				warn();
			}
		});
	}
}
