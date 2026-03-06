import type * as Redis from "ioredis";
import { DispatchingRedis } from "./DispatchingRedis";

describe("DispatchingRedis", () => {
	let mockRedis: jest.Mocked<Redis.RedisCommander>;
	let dispatchingRedis: DispatchingRedis;

	beforeEach(() => {
		mockRedis = {
			zrem: jest.fn(),
			zadd: jest.fn(),
			zrangebyscore: jest.fn(),
			zrevrangebyscore: jest.fn(),
			zincrby: jest.fn(),
			sadd: jest.fn(),
			srem: jest.fn(),
			sismember: jest.fn(),
			smembers: jest.fn(),
		} as unknown as jest.Mocked<Redis.RedisCommander>;
		dispatchingRedis = new DispatchingRedis(mockRedis);
	});

	describe("assignProcess", () => {
		// assignProcess が成功する場合
		it("assignProcess is successful", async () => {
			const process = {
				id: "process1",
				numDispatchedClients: 5,
				playId: "play1",
				trait: "trait1",
			};
			mockRedis.zrem.mockResolvedValueOnce(123);
			mockRedis.zadd.mockResolvedValueOnce("234");

			await expect(dispatchingRedis.assignProcess(process)).resolves.not.toThrow();
		});
	});

	describe("assignCapacity", () => {
		// assignCapacity が成功する場合
		it("assignCapacity is successful", async () => {
			const capacity = {
				processId: "process1",
				trait: "trait1",
				capacity: 5,
			};
			mockRedis.zrem.mockResolvedValueOnce(123);
			mockRedis.zadd.mockResolvedValueOnce("234");
			await expect(dispatchingRedis.assignCapacity(capacity)).resolves.not.toThrow();
		});
	});

	describe("unassignProcess", () => {
		// unassignProcess が成功する場合
		it("unassignProcess is successful", async () => {
			const process = {
				id: "process1",
				numDispatchedClients: 5,
				playId: "play1",
				trait: "trait1",
			};
			mockRedis.zrem.mockResolvedValueOnce(123);

			await expect(dispatchingRedis.unassignProcess(process)).resolves.not.toThrow();
		});
	});

	describe("unassignCapacity", () => {
		// unassignCapacity が成功する場合
		it("unassignCapacity is successful", async () => {
			const capacity = {
				processId: "process1",
				trait: "trait1",
				capacity: 5,
			};
			mockRedis.zrem.mockResolvedValueOnce(123);

			await expect(dispatchingRedis.unassignCapacity(capacity)).resolves.not.toThrow();
		});
	});

	describe("findProcesses", () => {
		// findProcesses が成功する場合
		it("findProcesses is successful", async () => {
			const trait = "trait1";
			const playId = "12345";
			const processId = "process1";
			const numDispatchedClients = 5;
			const values = [processId, numDispatchedClients.toString()];
			mockRedis.zrangebyscore.mockResolvedValueOnce(values);

			await expect(dispatchingRedis.findProcesses(trait, playId)).resolves.toEqual([
				{ _id: processId, _trait: trait, _playId: playId, _numDispatchedClients: numDispatchedClients },
			]);
		});
	});

	describe("findCapacities", () => {
		// findCapacities が成功する場合
		it("findCapacities is successful", async () => {
			const trait = "trait1";
			const processId = "process1";
			const capacity = 5;
			const values = [processId, capacity.toString()];
			mockRedis.zrevrangebyscore.mockResolvedValueOnce(values);

			await expect(dispatchingRedis.findCapacities(trait)).resolves.toEqual([
				{ _processId: processId, _trait: trait, _capacity: capacity },
			]);
		});
	});

	describe("increaseClient", () => {
		// increaseClient が成功する場合
		it("increaseClient is successful", async () => {
			const processId = "process1";
			const trait = "trait1";
			const playId = "play1";
			const increment = 5;
			mockRedis.zincrby.mockResolvedValueOnce("10");

			await expect(dispatchingRedis.increaseClient(processId, trait, playId, increment)).resolves.toEqual(10);
		});
	});

	describe("increaseCapacity", () => {
		// increaseCapacity が成功する場合
		it("increaseCapacity is successful", async () => {
			const processId = "process1";
			const trait = "trait1";
			const increment = 5;
			mockRedis.zincrby.mockResolvedValueOnce("10");

			await expect(dispatchingRedis.increaseCapacity(processId, trait, increment)).resolves.toEqual(10);
		});
	});

	describe("addExcludeProcess", () => {
		// addExcludeProcess が成功する場合
		it("addExcludeProcess is successful", async () => {
			const processId = "process1";
			const trait = "trait1";
			mockRedis.sadd.mockResolvedValueOnce(1234);

			await expect(dispatchingRedis.addExcludeProcess(processId, trait)).resolves.toEqual(1234);
		});
	});

	describe("removeExcludeProcess", () => {
		// removeExcludeProcess が成功する場合
		it("removeExcludeProcess is successful", async () => {
			const processId = "process1";
			const trait = "trait1";
			mockRedis.srem.mockResolvedValueOnce(1234);

			await expect(dispatchingRedis.removeExcludeProcess(processId, trait)).resolves.toEqual(1234);
		});
	});

	describe("isExcludeProcesses", () => {
		// isExcludeProcesses が true を返す場合
		it("should resolve true when sismember resolved with 1", async () => {
			const processId = "process1";
			const trait = "trait1";
			mockRedis.sismember.mockResolvedValueOnce(1);

			await expect(dispatchingRedis.isExcludeProcesses(processId, trait)).resolves.toEqual(true);
		});

		// isExcludeProcesses が false を返す場合
		it("should resolve false when sismember resolved with 0", async () => {
			const processId = "process1";
			const trait = "trait1";
			mockRedis.sismember.mockResolvedValueOnce(0);

			await expect(dispatchingRedis.isExcludeProcesses(processId, trait)).resolves.toEqual(false);
		});
	});

	describe("getExcludeProcesses", () => {
		// getExcludeProcesses が成功する場合
		it("getExcludeProcesses is successful", async () => {
			const trait = "trait1";
			const values = ["process1", "process2"];
			mockRedis.smembers.mockResolvedValueOnce(values);

			await expect(dispatchingRedis.getExcludeProcesses(trait)).resolves.toEqual(values);
		});
	});
});
