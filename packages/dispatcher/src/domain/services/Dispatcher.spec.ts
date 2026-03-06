import { Dispatcher } from "./Dispatcher";
import { Dispatching, CapacityLike } from "@akashic/dispatching-core";
import { ProcessLike as dispatchingCoreProcessLike } from "@akashic/dispatching-core";
import { ReadOnlyAliveMonitoring } from "@akashic/alive-monitoring-core";
import { ProcessLike as aliveMonitorProcessLike } from "@akashic/alive-monitoring-core";
import { ILogger } from "@akashic-system/logger";
import { PlaylogServerClientPool, PlaylogServerClient } from "./PlaylogServerClient";

describe("Dispatcher.dispatch", () => {
	let dispatcher: Dispatcher;
	let mockDispatcher: jest.Mocked<Dispatching>;
	let mockAliveMonitor: jest.Mocked<ReadOnlyAliveMonitoring>;
	let mockLogger: jest.Mocked<ILogger>;
	let mockPlaylogServerClientPool: jest.Mocked<PlaylogServerClientPool>;
	let mockPlaylogServerClient: jest.Mocked<PlaylogServerClient>;

	beforeEach(() => {
		mockDispatcher = {
			findProcesses: jest.fn(),
			findCapacities: jest.fn(),
			getExcludeProcesses: jest.fn(),
			increaseCapacity: jest.fn(),
			increaseClient: jest.fn(),
		} as any;

		mockAliveMonitor = {
			findProcessByTrait: jest.fn(),
		} as any;

		mockLogger = {
			info: jest.fn(),
			error: jest.fn(),
			warn: jest.fn(),
		} as any;

		mockPlaylogServerClient = {
			postDispatchedPlay: jest.fn(),
		} as any;

		mockPlaylogServerClientPool = {
			get: jest.fn().mockReturnValue(mockPlaylogServerClient),
		} as any;

		// シャッフルのランダム性がテストで邪魔になるため、意図的に shuffleProcessCount を 1 に設定
		dispatcher = new Dispatcher(mockDispatcher as any, mockAliveMonitor as any, 5000, 1);
		dispatcher.logger = mockLogger;

		// playlogServerPool をモックに置き換える
		Object.defineProperty(dispatcher, "playlogServerPool", {
			value: mockPlaylogServerClientPool,
		});
	});

	// dispatch に成功する場合 (forceProcessId あり)
	it("dispatch is successful with forceProcessId", async () => {
		mockAliveMonitor.findProcessByTrait.mockResolvedValueOnce(makeAliveMonitorProcessLikeArray(1, 1));
		mockDispatcher.increaseCapacity.mockResolvedValueOnce(1);
		mockDispatcher.increaseClient.mockResolvedValueOnce(1);
		mockPlaylogServerClient.postDispatchedPlay.mockResolvedValueOnce({ meta: { status: 200 } } as any);
		await expect(dispatcher.dispatch("playId", "trait", "playToken", "processId1")).resolves.toEqual("endpoint1");
	});

	// dispatch に成功する場合 (forceProcessId なし)
	it("dispatch is successful without forceProcessId", async () => {
		mockDispatcher.findProcesses.mockResolvedValueOnce(makeDispatchingCoreProcessLikeArray(1, 15));
		// 候補は processId1-15
		mockDispatcher.findCapacities.mockResolvedValueOnce(makeCapacityLikeArray(1, 25, 0));
		// 候補は processId1-25
		mockAliveMonitor.findProcessByTrait.mockResolvedValueOnce(makeAliveMonitorProcessLikeArray(11, 25));
		// 候補は processId11-25
		mockDispatcher.getExcludeProcesses.mockResolvedValueOnce(makeExcludeProcessesArray(11, 1));
		// 候補は processId12-25
		mockDispatcher.increaseCapacity.mockResolvedValueOnce(1);
		mockDispatcher.increaseClient.mockResolvedValueOnce(1);
		mockPlaylogServerClient.postDispatchedPlay.mockResolvedValueOnce({ meta: { status: 200 } } as any);
		await expect(dispatcher.dispatch("playId", "trait", "playToken")).resolves.toEqual("endpoint12");
	});
});

function makeDispatchingCoreProcessLikeArray(startIndex: number, count: number): dispatchingCoreProcessLike[] {
	const processes: dispatchingCoreProcessLike[] = [];
	for (let i = startIndex; i < startIndex + count; i++) {
		processes.push({
			id: `processId${i}`,
			playId: "playId",
			trait: "trait",
			numDispatchedClients: 0,
		});
	}
	return processes;
}

/**
 * CapacityLike の配列を生成する。 capacity が大きい順でソートされる。
 * @param startIndex processId の開始インデックス
 * @param count 生成する CapacityLike の数
 * @param zeroCapacityCount キャパシティが 0 のプロセスの数（processId が小さいものから 0 になる）
 * @returns 生成された CapacityLike の配列
 */
function makeCapacityLikeArray(startIndex: number, count: number, zeroCapacityCount: number): CapacityLike[] {
	const capacities: CapacityLike[] = [];
	for (let i = startIndex; i < startIndex + count; i++) {
		capacities.push({
			trait: "trait",
			processId: `processId${i}`,
			capacity: startIndex + zeroCapacityCount > i ? 0 : 10,
		});
	}
	capacities.sort((a, b) => {
		return b.capacity - a.capacity;
	});
	return capacities;
}

function makeAliveMonitorProcessLikeArray(startIndex: number, count: number): aliveMonitorProcessLike[] {
	const processes: aliveMonitorProcessLike[] = [];
	for (let i = startIndex; i < startIndex + count; i++) {
		processes.push({
			id: `processId${i}`,
			trait: "trait",
			endpoint: `endpoint${i}`,
			numMaxClients: 10,
			reservationEndpoint: `reservationEndpoint${i}`,
		});
	}
	return processes;
}

function makeExcludeProcessesArray(startIndex: number, count: number): string[] {
	const processes: string[] = [];
	for (let i = startIndex; i < startIndex + count; i++) {
		processes.push(`processId${i}`);
	}
	return processes;
}
