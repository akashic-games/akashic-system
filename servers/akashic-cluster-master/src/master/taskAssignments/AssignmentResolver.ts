import { context } from "@akashic-system/logger";
import * as dt from "@akashic/server-engine-data-types";
import { LogFactory } from "../../util/LogFactory";
import { ProcessConnections } from "../connections/ProcessConnections";
import { BootQueueMessage } from "../queues/BootQueueMessage";
import { InstanceAssignmentRepository } from "../repositories/InstanceAssignmentRepository";
import { ProcessRepository } from "../repositories/ProcessRepository";
import { Designator } from "./strategies/assignments/Designator";
import { Evaluator } from "./strategies/costEvaluations/Evaluator";
import { StandardEvaluator as DefaultEvaluator } from "./strategies/costEvaluations/StandardEvaluator";
import { SearchResult } from "./strategies/dataTypes/SearchResult";
import { TaskAssignmentTarget } from "./strategies/dataTypes/TaskAssignmentTarget";
import { DefaultSearcher } from "./strategies/searches/DefaultSearcher";
import { Searcher } from "./strategies/searches/Searcher";

export enum ResolveResult {
	SUCCESS,
	FAIL,
}
export interface ResolverResult {
	message: BootQueueMessage;
	resolveResult: ResolveResult;
	target: dt.ClusterIdentity;
}

export class AssignmentResolver {
	private _processRepository: ProcessRepository;
	private _evaluator: Evaluator;
	private _defaultSearcher: Searcher;
	private _designator: Designator;
	private _logFactory: LogFactory;

	constructor(
		processRepository: ProcessRepository,
		instanceAssignmentRepository: InstanceAssignmentRepository,
		processConnections: ProcessConnections,
		logFactory: LogFactory,
	) {
		this._logFactory = logFactory;
		this._processRepository = processRepository;
		// 使用するロジックは初期は固定なので、ここで対応する
		this._evaluator = new DefaultEvaluator();
		this._defaultSearcher = new DefaultSearcher(processRepository, instanceAssignmentRepository, logFactory);
		this._designator = new Designator(instanceAssignmentRepository, processConnections, logFactory);
	}

	public async resolve(message: BootQueueMessage): Promise<ResolverResult> {
		/**
		 * 割り当て時に例外が発生したときの挙動を決めておらず、無限リトライにはまっている
		 */
		const log = this._logFactory.getLogger("out");
		const evaluateResult = await this._evaluator.evaluateCost(message);
		log.info(
			"コスト見積もり完了",
			context({
				instanceId: message.instanceId,
				requirement: evaluateResult.requirement,
				forceAssignTo: message.forceAssignTo,
			}),
		);
		let result: SearchResult;
		if (message.forceAssignTo) {
			log.trace("強制割り当てを試みます");
			result = await this.assignToFixedTarget(message);
		} else {
			log.trace("新規割り当てを試みます");
			const searchResults = await this._defaultSearcher.search(evaluateResult);
			result = await this.assignTask(searchResults);
		}
		log.trace(result !== null ? "割り当てに成功しました" : "割り当てができませんでした");
		return {
			message,
			resolveResult: result !== null ? ResolveResult.SUCCESS : ResolveResult.FAIL,
			target: result !== null ? result.target.targetIdentity : null,
		};
	}

	private async assignTask(searchResults: SearchResult[]): Promise<SearchResult> {
		const log = this._logFactory.getLogger("out");
		log.trace("assignTaskを実行します", context({ targetCount: searchResults.length.toString() }));

		for (let i = 0; i < searchResults.length; ++i) {
			const target = searchResults[i];
			const instanceId = target.message.instanceId;
			const targetName = target.target.targetIdentity.getKeyString();
			log.info(`try to assign instance ${instanceId} to ${targetName}`);
			const result = await this._designator.assign(target);
			if (result === true) {
				log.info(`instance ${instanceId} was assigned to ${targetName}`);
				return target;
			} else {
				log.warn(`failed to assign instance ${instanceId} to ${targetName}, try next candidate.`);
			}
		}
		log.warn("no valid assign targets.");
		return null;
	}

	private async assignToFixedTarget(message: BootQueueMessage): Promise<SearchResult> {
		const revFqdn = dt.Fqdn.fromObject(message.forceAssignTo.host).toReverseFQDN();
		const processName = message.forceAssignTo.name;
		const type = dt.Constants.TYPE_GAME_RUNNER_2;
		const processes = await this._processRepository.find(revFqdn, type);
		const target = processes.find((process) => process.clusterIdentity.name === processName);
		if (!target) {
			return null;
		}

		const assignTargets = new SearchResult(new TaskAssignmentTarget(target.clusterIdentity, target.port, message.cost), 1, message);
		return this.assignTask([assignTargets]);
	}
}
