import { Database } from "@akashic/akashic-active-record";
import { Constants, Instance } from "@akashic/server-engine-data-types";
import { Connection } from "@akashic/tapper";
import { CallbackPublisher } from "./CallbackPublisher";

export class StatusUpdater {
	private _database: Database;
	private _publisher: CallbackPublisher;

	constructor(database: Database, publisher: CallbackPublisher) {
		this._database = database;
		this._publisher = publisher;
	}

	public update(conn: Connection, instanceId: string, status: string, exitCode?: number, processName?: string): Promise<void> {
		return this._database.repositories.instance
			.updateStatus(instanceId, status, exitCode, processName, conn)
			.then((instance) => this._publishEvents(instance, status, exitCode));
	}

	public updateByInstance(
		conn: Connection,
		instance: Instance,
		status: string,
		exitCode?: number,
		processName?: string,
		message?: string,
	): Promise<void> {
		return this._database.repositories.instance
			.updateStatus(instance.id, status, exitCode, processName, conn)
			.then((updatedInstance) => this._publishEvents(updatedInstance, status, exitCode, message));
	}

	private _publishEvents(instance: Instance, status: string, exitCode: number, message?: string): Promise<void> {
		if (status === Constants.INSTANCE_STATE_ERROR) {
			return this._publisher
				.publishInstanceStateChangedEvent(instance, status)
				.then(() => this._publisher.publishInstanceErrorEvent(instance.id, exitCode, message));
		} else {
			return this._publisher.publishInstanceStateChangedEvent(instance, status);
		}
	}
}
