import { Database } from "@akashic/akashic-active-record";
import { ZookeeperRepository } from "@akashic/alive-monitoring-core";

export interface ClusterSummaryModel {
	master: {
		host: string;
		port: number;
	};
	numProcesses: number;
	numInstances: number;
	capacity: {
		total: number;
		used: number;
	};
}

export class Cluster {
	private _zkRepository: ZookeeperRepository;
	private _database: Database;

	constructor(database: Database, zkRepository: ZookeeperRepository) {
		this._zkRepository = zkRepository;
		this._database = database;
	}

	public getSummary(): Promise<ClusterSummaryModel> {
		return Promise.all([
			this._zkRepository.getJson("/cluster/master"),
			this._database.repositories.process.getAll(),
			this._database.repositories.instanceAssignment.getAll(),
		]).then((result) => {
			const master = result[0];
			const processes = result[1];
			const instances = result[2];
			let totalCapacity = 0;
			for (let i = 0; i < processes.length; i++) {
				totalCapacity += processes[i].machineValues.capacity;
			}
			let usedCapacity = 0;
			for (let i = 0; i < instances.length; i++) {
				usedCapacity += instances[i].requirement;
			}
			return {
				master: {
					host: master.fqdn,
					port: master.port,
				},
				numProcesses: Number(processes.length),
				numInstances: Number(instances.length),
				capacity: {
					total: totalCapacity,
					used: usedCapacity,
				},
			};
		});
	}
}
