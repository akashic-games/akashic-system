import * as ServerEngineDataTypes from "@akashic/server-engine-data-types";
import Param = require("../controllers/process/ProcessesRequest");

export interface ProcessRepository {
	find(param: Param): Promise<ServerEngineDataTypes.Process[]>;
	count(param: Param): Promise<string>;
	getAll(): Promise<ServerEngineDataTypes.Process[]>;
	getAllExcluded(): Promise<ServerEngineDataTypes.ProcessIdentity[]>;
	getFqdn(): Promise<ServerEngineDataTypes.Fqdn[]>;
	changeProcessMode(identity: ServerEngineDataTypes.ProcessIdentity, mode: string): Promise<{}>;
}

export interface InstanceRepository {
	getByName(name: string): Promise<ServerEngineDataTypes.InstanceAssignment[]>;
}
