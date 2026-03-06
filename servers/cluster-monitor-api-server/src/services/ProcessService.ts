import restCommons = require("@akashic/akashic-rest-commons");
import * as ServerEngineDataTypes from "@akashic/server-engine-data-types";
import Param = require("../controllers/process/ProcessesRequest");
import type { ProcessRepository } from "../repositories/Repository";
import type { ZookeeperRepository } from "@akashic/alive-monitoring-core";

type MachineValueTrait = string | string[] | undefined;
type FormattedTrait = string[];

export interface ProcessModel {
	processName: string;
	type: string;
	host: string;
	port: number;
	czxid: string;
	capacity: number;
	videoEnabled: boolean;
	mode: string;
	status: any;
	trait: FormattedTrait;
}

export function getMachineValueTrait(identity: ServerEngineDataTypes.Process): MachineValueTrait {
	const machineValues: any = identity.machineValues;
	if (machineValues) {
		if (Array.isArray(machineValues.trait)) {
			return machineValues.trait;
		} else if (typeof machineValues.trait === "string") {
			// 後方互換のために trait が文字列だった場合にも文字列の配列に変換して対応（後々削除すること）
			if (machineValues.trait.startsWith("[")) {
				try {
					return JSON.parse(machineValues.trait);
				} catch (e) {
					return undefined;
				}
			} else {
				return machineValues.trait.split(",");
			}
		}
	}
	return undefined;
}

export function formatTrait(machineValueTrait: MachineValueTrait): FormattedTrait {
	if (machineValueTrait === undefined) {
		return [];
	} else if (typeof machineValueTrait === "string") {
		return [machineValueTrait];
	} else {
		return machineValueTrait;
	}
}

export class ProcessService {
	private _processRepository: ProcessRepository;
	private _zkRepository: ZookeeperRepository;

	constructor(processRepository: ProcessRepository, zkRepository: ZookeeperRepository) {
		this._processRepository = processRepository;
		this._zkRepository = zkRepository;
	}

	public async find(param: Param): Promise<ServerEngineDataTypes.PagingResponse<ProcessModel>> {
		const paramWithDefaultValue: Param = {
			...param,
			_offset: param._offset || 0,
			_limit: param._limit || 1000,
		};
		const processes = await this.identities2Processes(
			await this._processRepository.find(paramWithDefaultValue),
			await this._processRepository.getAllExcluded(),
		);
		const count = await this._processRepository.count(paramWithDefaultValue);
		const result = new ServerEngineDataTypes.PagingResponse<ProcessModel>({
			values: processes,
			totalCount: count,
		});
		return result;
	}

	private identities2Processes(
		identities: ServerEngineDataTypes.Process[],
		excludedIdentities: ServerEngineDataTypes.ProcessIdentity[],
	): Promise<ProcessModel[]> {
		return Promise.all(
			identities.map(
				async (identity) => await this.identity2Process(identity, excludedIdentities).catch((error) => error.process as ProcessModel),
			),
		);
	}

	private identity2Process(
		identity: ServerEngineDataTypes.Process,
		excludedIdentities: ServerEngineDataTypes.ProcessIdentity[],
	): Promise<ProcessModel> {
		const name = [identity.clusterIdentity.fqdn.toReverseFQDN(), identity.clusterIdentity.type, identity.clusterIdentity.name].join(".");
		const result: ProcessModel = {
			processName: name,
			type: identity.clusterIdentity.type,
			host: identity.clusterIdentity.fqdn.value,
			port: identity.port,
			czxid: identity.clusterIdentity.czxid,
			capacity: Number(identity.machineValues.capacity),
			videoEnabled: !!identity.machineValues.videoEnabled,
			mode: this.isStandby(identity, excludedIdentities) ? "standby" : "normal",
			status: undefined,
			trait: this.getTrait(identity),
		};
		return this.getZnodeData(name)
			.then((data) => {
				result.status = data.status;
				return result;
			})
			.catch((err) => {
				return Promise.reject({
					error: err,
					process: result,
				});
			});
	}

	private isStandby(identity: ServerEngineDataTypes.Process, excludeIdentities: ServerEngineDataTypes.ProcessIdentity[]): boolean {
		const process = new ServerEngineDataTypes.ProcessIdentity({
			fqdn: new ServerEngineDataTypes.Fqdn(identity.clusterIdentity.fqdn.value),
			type: identity.clusterIdentity.type,
			name: identity.clusterIdentity.name,
		});
		for (const excludeIdentity of excludeIdentities) {
			if (
				excludeIdentity.fqdn.value === process.fqdn.value &&
				excludeIdentity.type === process.type &&
				excludeIdentity.name === process.name
			) {
				return true;
			}
		}
		return false;
	}

	private getTrait(identity: ServerEngineDataTypes.Process): FormattedTrait {
		const machineValueTrait = getMachineValueTrait(identity);
		return formatTrait(machineValueTrait);
	}

	private getZnodeData(name: string): Promise<any> {
		return this._zkRepository.getJson("/cluster/aliveMonitoring/" + name);
	}

	public getProcessFromName(name: string): Promise<ProcessModel> {
		return Promise.all([this._processRepository.getAll(), this._processRepository.getAllExcluded()])
			.then((result) => {
				const processes = result[0];
				const excludedProcesses = result[1];
				for (let i = 0; i < processes.length; i++) {
					const identity = processes[i];
					const currentName = [
						identity.clusterIdentity.fqdn.toReverseFQDN(),
						identity.clusterIdentity.type,
						identity.clusterIdentity.name,
					].join(".");
					if (currentName === name) {
						return this.identity2Process(identity, excludedProcesses);
					}
				}
				return Promise.reject(new restCommons.Errors.NotFound(`not found process. name:${name}`));
			})
			.catch((err) => {
				if (err.error) {
					err = err.error;
				}
				return Promise.reject(err);
			});
	}

	public async getFqdn(): Promise<ServerEngineDataTypes.PagingResponse<string>> {
		const fqdn: ServerEngineDataTypes.Fqdn[] = await this._processRepository.getFqdn();
		const result = new ServerEngineDataTypes.PagingResponse<string>({
			values: fqdn.map((name) => name.value),
			totalCount: fqdn.length.toString(),
		});
		return result;
	}

	public changeProcessMode(name: string, mode: string): Promise<{}> {
		const splitedName = name.split(".").reverse();
		const identity = new ServerEngineDataTypes.ProcessIdentity({
			name: splitedName[0],
			type: splitedName[1],
			fqdn: new ServerEngineDataTypes.Fqdn(splitedName.slice(2).join(".")),
		});
		return this._processRepository.changeProcessMode(identity, mode);
	}

	public async changeProcessesMode(host: string, mode: string): Promise<{}> {
		if (mode !== "normal" && mode !== "standby") {
			return Promise.reject("normal or standby only");
		}
		const param = { _offset: 0, _limit: 1000, count: 1, host };
		const result = await this.find(param);
		for (let i = 0; i < result.values.length; i++) {
			try {
				await this.changeProcessMode(result.values[i].processName, mode);
			} catch (error) {
				// 特に何もしない
			}
		}
	}
}
