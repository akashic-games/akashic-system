import { context } from "@akashic-system/logger";
import { LogFactory } from "../../../../util/LogFactory";
import { InstanceAssignmentRepository } from "../../../repositories/InstanceAssignmentRepository";
import { ProcessRepository } from "../../../repositories/ProcessRepository";
import { EvaluateResult } from "../dataTypes/EvaluateResult";
import { SearchResult } from "../dataTypes/SearchResult";
import { TaskAssignmentTarget } from "../dataTypes/TaskAssignmentTarget";
import { Searcher } from "./Searcher";

function getCapacity(machineValues: any): number {
	let capacity = 100; // machineValuesに情報が無い場合、割り当て容量を100とみなす
	if (machineValues && typeof machineValues.capacity === "number") {
		capacity = machineValues.capacity;
	}
	return capacity;
}

function getVideoEnabled(machineValues: any): boolean {
	if (machineValues && typeof machineValues.videoEnabled === "boolean") {
		return machineValues.videoEnabled;
	}
	return false;
}

function getTrait(machineValues: any): string[] {
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

export class DefaultSearcher implements Searcher {
	private _processRepository: ProcessRepository;
	private _instanceAssignmentRepository: InstanceAssignmentRepository;
	private _logFactory: LogFactory;
	constructor(processRepository: ProcessRepository, instanceAssignmentRepository: InstanceAssignmentRepository, logFactory: LogFactory) {
		this._processRepository = processRepository;
		this._instanceAssignmentRepository = instanceAssignmentRepository;
		this._logFactory = logFactory;
	}

	public async search(evaluateResult: EvaluateResult): Promise<SearchResult[]> {
		const log = this._logFactory.getLogger("out");
		log.trace("DefaultSearcher::searchを開始", context({ target: evaluateResult.message.gameCode }));

		const processes = await this._processRepository.getAll();
		const excludedProcesses = await this._processRepository.getExcludedProcess();
		const requirement = evaluateResult.requirement;
		log.trace(
			"DefaultSearcher::検索パラメータ",
			context({
				processes,
				excludedProcesses,
				requirement,
			}),
		);
		const searchResults: SearchResult[] = [];
		for (let i = 0; i < processes.length; ++i) {
			const process = processes[i];

			// 割り当て抑止プロセスを除外
			if (
				excludedProcesses.some(
					(excludedProcess) =>
						process.clusterIdentity.fqdn.value === excludedProcess.fqdn.value &&
						process.clusterIdentity.type === excludedProcess.type &&
						process.clusterIdentity.name === excludedProcess.name,
				)
			) {
				continue;
			}

			// ビデオ出力要求とプロセスのビデオサポートが合ってない場合は割り当てない
			const videoEnabled = getVideoEnabled(process.machineValues);
			if ((requirement.video && !videoEnabled) || (!requirement.video && videoEnabled)) {
				continue;
			}

			// trait 無しで要求された場合は、trait 付きのプロセスには割り当てない
			const trait = getTrait(process.machineValues);
			if (requirement.trait == null && trait !== undefined) {
				continue;
			}
			// trait 付きで要求された場合は trait が一致しないところに割り当てない
			if (requirement.trait != null) {
				if (trait === undefined) {
					// trait 無しのプロセスには割り当てない
					continue;
				} else {
					if (
						requirement.trait.length !== trait.length ||
						!requirement.trait.every((requirementTrait) => trait.includes(requirementTrait))
					) {
						// 要求された trait の中身と完全に一致しない場合は割り当てない
						continue;
					}
				}
			}

			// capacity 足りないところには割り当てない
			const capacity = getCapacity(process.machineValues);
			const assignedStatus = await this._instanceAssignmentRepository.getAssignmentStatus(process.clusterIdentity);
			const score = capacity - assignedStatus.assigned - requirement.cost;
			if (score < 0) {
				continue;
			}

			// 候補に追加
			searchResults.push(
				new SearchResult(new TaskAssignmentTarget(process.clusterIdentity, process.port, requirement.cost), score, evaluateResult.message),
			);
		}

		log.trace("DefaultSearcher::searchを終了", context({ searchResults }));

		return searchResults.sort((a, b) => b.score - a.score);
	}
}
