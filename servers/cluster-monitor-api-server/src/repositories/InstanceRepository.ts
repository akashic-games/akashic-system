import * as ServerEngineDataTypes from "@akashic/server-engine-data-types";
import type { Database } from "@akashic/akashic-active-record";
import type { InstanceRepository } from "./Repository";

export function createInstanceRepository(database: Database): InstanceRepository {
	return new InstanceRepositoryMySQL(database);
}

class InstanceRepositoryMySQL implements InstanceRepository {
	private _database: Database;

	constructor(database: Database) {
		this._database = database;
	}

	public getByName(name: string): Promise<ServerEngineDataTypes.InstanceAssignment[]> {
		const splitName = name.split(".").reverse();
		return this._database.repositories.instanceAssignment.getByIdentity({
			name: splitName[0],
			type: splitName[1],
			fqdn: new ServerEngineDataTypes.Fqdn(splitName.slice(2).join(".")),
			czxid: undefined,
		});
	}
}
