import { context, Logger, LoggerAware } from "@akashic-system/logger";
import { ProcessLike, ReadOnlyAliveMonitoring } from "@akashic/alive-monitoring-core";
import { Dispatching, DispatchingRedis, CapacityLike } from "@akashic/dispatching-core";
import { performance } from "perf_hooks";
import { PlaylogServerClientPool } from "./PlaylogServerClient";

/**
 * 既存プロセス検索用のI/F
 */
interface ExistingProcessLike {
	trait: string;
	// ProcessLikeのプロセスID
	id?: string;
	// CapacityLikeのプロセスID
	processId?: string;
}

/**
 * サーバ割り当てのメインサービス
 */
export class Dispatcher extends LoggerAware {
	private dispatcher: Dispatching;
	private aliveMonitor: ReadOnlyAliveMonitoring;
	private monitorCacheExpireMsec: number;
	private excludeProcessesCacheExpireMsec: number;
	private aliveProcessesCache: { [trait: string]: ProcessLike[] };
	private aliveProcessesCacheTime: Date;
	private excludeProcessesCache: { [trait: string]: Set<string> };
	private excludeProcessesCacheTime: Date;
	private playlogServerPool: PlaylogServerClientPool;
	private shuffleProcessCount: number;

	constructor(
		dispatchingRedis: DispatchingRedis,
		aliveMonitoring: ReadOnlyAliveMonitoring,
		monitorCacheExpire: number,
		shuffleProcessCount: number = 5,
	) {
		super();
		this.dispatcher = dispatchingRedis;
		this.aliveMonitor = aliveMonitoring;
		this.monitorCacheExpireMsec = monitorCacheExpire ? monitorCacheExpire : 5000;
		// 複数台のサーバーが同じ周期にならないように、 monitorCacheExpireMsec の10倍〜29倍の期間のどれかを設定
		this.excludeProcessesCacheExpireMsec = this.monitorCacheExpireMsec * (Math.floor(Math.random() * 20) + 10);
		this.aliveProcessesCache = {};
		this.aliveProcessesCacheTime = new Date();
		this.excludeProcessesCache = {};
		this.excludeProcessesCacheTime = new Date();
		this.playlogServerPool = new PlaylogServerClientPool();
		this.shuffleProcessCount = shuffleProcessCount;
	}

	public dispatch(playId: string, trait: string, playToken: string, forceProcessId?: string): Promise<string> {
		return this.doDispatch(playId, trait, playToken, forceProcessId)
			.then((endpoint) => Promise.resolve(endpoint))
			.catch((error) => Promise.reject(error));
	}

	private async doDispatch(playId: string, trait: string, playToken: string, forceProcessId?: string): Promise<string> {
		const logger = new Logger(this.logger.appenders);
		logger.context.set("playId", playId);
		logger.context.set("trait", trait);
		const startTime = performance.now();

		if (forceProcessId) {
			try {
				// 実際の状態にかかわらず指定されたプロセスに割り当てる:
				const forceProcess = await this.assignForceProcess(playId, trait, playToken, forceProcessId);
				return forceProcess.endpoint;
			} catch (error) {
				logger.error("force process assigning error:", context({ error: String(error) }));
				throw error;
			}
		}

		try {
			const processes = await this.listCandidateProcesses(trait, playId);
			if (!processes || processes.length === 0) {
				throw new Error("cannot find candidate processes");
			}
			const assignedProcess = await this.assignProcessWithCandidates(processes, playId, trait, playToken);
			if (!assignedProcess) {
				throw new Error("cannot assign process");
			}

			return assignedProcess.endpoint;
		} catch (error) {
			logger.error("process assigning error:", context({ error: String(error), stack: (error as unknown as Error).stack ?? "" }));
			throw error;
		} finally {
			const execTime = performance.now() - startTime;
			if (execTime > 1000) {
				logger.warn(`process assigned. time: ${execTime} ms.`);
			}
		}
	}

	/**
	 * 割り当て用のプロセスのリストを返す。
	 * このメソッドを並列に呼び出すと、プロセスの割り当てが競合したり、 shuffleProcessCount 以上に割り当て対象が増えたりする可能性がある。
	 * しかし Mutex などで排他制御を行うと、プロセスの割り当てが遅くなるため、排他制御は行わない。
	 * 割り当て対象が shuffleProcessCount 以上に増えることを許容する方針とする。
	 * @param trait プロセスのtrait
	 * @param playId プレイID
	 */
	private async listCandidateProcesses(trait: string, playId: string): Promise<ProcessLike[]> {
		const logger = new Logger(this.logger.appenders);
		logger.context.set("playId", playId);
		logger.context.set("trait", trait);

		try {
			/**
			 * 割り当てるプロセス候補の優先度順リストを作る
			 * リストの順番は、以下のとおり
			 * 1. dispatcher.findProcesses から取得したプロセス
			 * 2. dispatcher.findCapacities から取得したプロセスから 1 のプロセスを除いたもの
			 */
			const processes = await this.dispatcher.findProcesses(trait, playId);
			logger.debug(`processes length: ${processes.length}`);
			const capacities = await this.dispatcher.findCapacities(trait);
			const deDuplicatedCapacities = this.removeDuplicateCapacities(capacities, processes);
			const orderedProcesses = [...processes, ...deDuplicatedCapacities];

			// orderedProcesses のうち、キャパシティが0のプロセスを除外
			const orderedProcessesWithoutZeroCapacity = this.removeZeroCapacityProcesses(orderedProcesses, capacities);

			// orderedProcessesWithoutZeroCapacity のうち、生存しているプロセスのみをリストアップ
			const aliveProcesses = await this.pickAliveProcesses(orderedProcessesWithoutZeroCapacity, trait);

			// aliveProcesses から割り当て除外プロセスを除外
			const excludeProcessesRemovedCandidates = await this.removeExcludeProcesses(aliveProcesses, trait);

			// 適度に偏らせるため、上位 shuffleProcessCount をシャッフル:
			const shuffleTargetEndIndex = Math.min(excludeProcessesRemovedCandidates.length, this.shuffleProcessCount);
			const shuffledPart = this.shuffleProcesses(excludeProcessesRemovedCandidates.slice(0, shuffleTargetEndIndex));
			const shuffledCandidates = [...shuffledPart, ...excludeProcessesRemovedCandidates.slice(shuffleTargetEndIndex)];

			return shuffledCandidates;
		} catch (error) {
			logger.error("process finding error:", context({ error: String(error) }));
			throw error;
		}
	}

	/**
	 * processLikes のリストから capacityLikes の capacity が 0 のプロセスを除外する
	 * @param processLikes プロセスのリスト
	 * @param capacityLikes キャパシティのリスト
	 * @returns capacity が 0 のプロセスを除外したプロセスのリスト
	 */
	private removeZeroCapacityProcesses(processLikes: ExistingProcessLike[], capacityLikes: CapacityLike[]): ExistingProcessLike[] {
		const result = [];
		const zeroCapacities = capacityLikes.filter((capacity) => capacity.capacity < 1);
		const zeroCapacityProcessIds = new Set(zeroCapacities.map((capacity) => capacity.processId));
		for (const process of processLikes) {
			if (process.processId && zeroCapacityProcessIds.has(process.processId)) {
				continue;
			}
			if (process.id && zeroCapacityProcessIds.has(process.id)) {
				continue;
			}
			result.push(process);
		}
		return result;
	}

	/**
	 * capacityLikes から excludeProcesses に含まれるプロセスを除外する
	 * @param capacityLikes capacity のリスト
	 * @param excludeProcesses 除外するプロセスのリスト
	 */
	private removeDuplicateCapacities(capacities: CapacityLike[], excludeProcesses: ExistingProcessLike[]): CapacityLike[] {
		const result = [];
		const excludeProcessIds = new Set(excludeProcesses.map((process) => process.id));
		for (const capacity of capacities) {
			if (!excludeProcessIds.has(capacity.processId)) {
				result.push(capacity);
			}
		}
		return result;
	}

	/**
	 * 生存しているプロセスのみのリストを返す
	 * @param processes プロセスのリスト
	 * @param trait プロセスのtrait
	 */
	private async pickAliveProcesses(processes: ExistingProcessLike[], trait: string): Promise<ProcessLike[]> {
		const aliveProcesses = await this.getAliveProcesses(trait);
		const result = [];
		for (const process of processes) {
			for (const aliveProcess of aliveProcesses) {
				if (aliveProcess.id === process.id || aliveProcess.id === process.processId) {
					result.push(aliveProcess);
				}
			}
		}
		return result;
	}

	/**
	 * 割り当て除外プロセスを除外する
	 * @param processLikes プロセスのリスト
	 * @param trait 割り当て除外プロセスのtrait
	 */
	private async removeExcludeProcesses(processes: ProcessLike[], trait: string): Promise<ProcessLike[]> {
		const excludeProcessIds = await this.getExcludeProcesses(trait);
		const result = [];
		for (const process of processes) {
			if (!excludeProcessIds.has(process.id)) {
				result.push(process);
			}
		}
		return result;
	}

	/**
	 * プロセスのリストをシャッフルする
	 * @param process シャッフル対象のプロセスのリスト
	 * @returns process の順番をランダムに並び替えたもの
	 */
	private shuffleProcesses(array: ProcessLike[]): ProcessLike[] {
		for (let i = array.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[array[i], array[j]] = [array[j], array[i]];
		}
		return array;
	}

	private async assignExistingProcess(process: ProcessLike, playId: string, trait: string, playToken: string): Promise<ProcessLike> {
		if (!process || !process.reservationEndpoint) {
			throw new Error(`existing process not assigned. processId: ${process.id}`);
		}

		const isProcessIncreased = await this.isProcessIncreased(process.id, playId, trait);
		if (!isProcessIncreased) {
			throw new Error(`existing process not assigned. processId: ${process.id}`);
		}

		await this.reserveEndpoint(process.reservationEndpoint, playId, playToken);
		return process;
	}

	private async assignForceProcess(playId: string, trait: string, playToken: string, forceProcessId: string): Promise<ProcessLike> {
		const aliveProcesses = await this.getAliveProcesses(trait);
		const forceProcess = aliveProcesses.find((aliveProcess) => aliveProcess?.id === forceProcessId);

		if (!forceProcess) {
			throw new Error(`force process not assigned. forceProcessId: ${forceProcessId}`);
		}

		return await this.assignExistingProcess(forceProcess, playId, trait, playToken);
	}

	private async assignProcessWithCandidates(
		candidateProcesses: ProcessLike[],
		playId: string,
		trait: string,
		playToken: string,
	): Promise<ProcessLike | null> {
		try {
			let assignedProcess: ProcessLike | null = null;
			for (const candidate of candidateProcesses) {
				try {
					assignedProcess = await this.assignExistingProcess(candidate, playId, trait, playToken);
					break;
				} catch (error) {
					continue;
				}
			}

			this.logger.info(`assigned process: ${assignedProcess ? JSON.stringify(assignedProcess) : "not found"}`);

			return assignedProcess;
		} catch (error) {
			this.logger.error("process assigning error:", context({ error: String(error) }));
			throw error;
		}
	}

	private async isProcessIncreased(processId: string, playId: string, trait: string): Promise<boolean> {
		const startTime = performance.now();

		try {
			// capacityを1減らす
			const capacity = await this.dispatcher.increaseCapacity(processId, trait, -1);

			if (capacity < 0) {
				// capacityがマイナスになっている場合はもとの数に戻して終了
				const resetCapacity = await this.dispatcher.increaseCapacity(processId, trait, 1);
				this.logger.warn(`process(${processId}) capacity over, rollback: ${capacity} => ${resetCapacity}`);
				return false;
			}

			this.logger.info(`process(${processId}) capacity: ${capacity}`);

			// 割り当て数を1増やす
			await this.dispatcher.increaseClient(processId, trait, playId, 1);
			return true;
		} catch (error) {
			this.logger.warn(`process(${processId}) increasing error:`, context({ error: String(error) }));
			return false;
		} finally {
			const execTime = performance.now() - startTime;
			if (execTime > 1000) {
				this.logger.warn(`process increased. time: ${execTime} ms.`);
			}
		}
	}

	private async reserveEndpoint(endpoint: string, playId: string, playToken: string): Promise<string> {
		const startTime = performance.now();

		if (!endpoint) {
			throw new Error("invalid endpoint");
		}

		try {
			const playlogServerClient = this.playlogServerPool.get(endpoint);
			const res = await playlogServerClient.postDispatchedPlay(playId, playToken);
			if (res.meta.status !== 200) {
				throw new Error("post dispatched play error");
			}

			return endpoint;
		} catch (error) {
			this.logger.error("endpoint reserving error:", context({ error: String(error) }));
			throw error;
		} finally {
			const execTime = performance.now() - startTime;
			if (execTime > 1000) {
				this.logger.warn(`endpoint reserved. time: ${execTime} ms.`);
			}
		}
	}

	private async getAliveProcesses(trait: string): Promise<ProcessLike[]> {
		if (this.aliveProcessesCache[trait] && !this.cacheExpired(this.aliveProcessesCacheTime, this.monitorCacheExpireMsec)) {
			return this.aliveProcessesCache[trait];
		}

		const aliveProcesses = await this.aliveMonitor.findProcessByTrait(trait);
		this.aliveProcessesCache[trait] = aliveProcesses;
		this.aliveProcessesCacheTime = new Date();
		return aliveProcesses;
	}

	private async getExcludeProcesses(trait: string): Promise<Set<string>> {
		if (this.excludeProcessesCache[trait] && !this.cacheExpired(this.excludeProcessesCacheTime, this.excludeProcessesCacheExpireMsec)) {
			return this.excludeProcessesCache[trait];
		}

		const excludeProcesses = new Set(await this.dispatcher.getExcludeProcesses(trait));
		this.excludeProcessesCache[trait] = excludeProcesses;
		this.excludeProcessesCacheTime = new Date();
		return excludeProcesses;
	}

	private cacheExpired(cacheTime: Date, expire: number): boolean {
		return new Date().getTime() - cacheTime.getTime() > expire;
	}
}
