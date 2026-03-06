import * as ServerEngineDataTypes from "@akashic/server-engine-data-types";
import Param = require("../controllers/process/ProcessesRequest");
import type { Database } from "@akashic/akashic-active-record";
import type { ProcessRepository } from "./Repository";

export function createProcessRepository(database: Database): ProcessRepository {
	return new ProcessRepositoryMySQL(database);
}

class ProcessRepositoryMySQL implements ProcessRepository {
	private _database: Database;

	constructor(database: Database) {
		this._database = database;
	}

	public async find(param: Param): Promise<ServerEngineDataTypes.Process[]> {
		const fqdn = (param.host || "").split(".").reverse().join(".");
		return await this._database.repositories.process.find(fqdn, param.type, param._offset, param._limit);
	}

	public async count(param: Param): Promise<string> {
		const fqdn = (param.host || "").split(".").reverse().join(".");
		return await this._database.repositories.process.count(fqdn, param.type);
	}

	public async getAll(): Promise<ServerEngineDataTypes.Process[]> {
		return await this._database.repositories.process.getAll();
	}

	public async getAllExcluded(): Promise<ServerEngineDataTypes.ProcessIdentity[]> {
		return await this._database.repositories.excludedProcess.getAll();
	}

	public async getFqdn(): Promise<ServerEngineDataTypes.Fqdn[]> {
		return await this._database.repositories.process.getFqdn();
	}

	public async changeProcessMode(identity: ServerEngineDataTypes.ProcessIdentity, mode: string): Promise<{}> {
		return new Promise((resolve: Function, reject: (error: any) => void) => {
			if (mode !== "normal" && mode !== "standby") {
				return reject("normal or standby only");
			}
			return this._database
				.transaction((connection) => {
					if (mode === "normal") {
						return this._database.repositories.excludedProcess.remove(identity, connection).then(() => {
							return resolve();
						});
					} else if (mode === "standby") {
						return this._database.repositories.excludedProcess.save(identity, connection).then(() => {
							return resolve();
						});
					}
				})
				.catch(reject);
		});
	}
}
