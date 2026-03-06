import { AliveMonitoringRedis } from "./AliveMonitoringRedis";
import { RedisCommander } from "ioredis";

describe("AliveMonitoringRedis", () => {
	describe("findProcessByTrait", () => {
		let aliveMonitoring: AliveMonitoringRedis;
		let redisClient: RedisCommander;

		beforeEach(() => {
			redisClient = {
				hgetall: jest.fn().mockResolvedValue({
					process1: JSON.stringify({
						id: "process1",
						trait: "trait1",
						endpoint: "endpoint1",
						numMaxClients: 10,
						reservationEndpoint: "reservation1",
					}),
					process2: JSON.stringify({
						id: "process2",
						trait: "trait1",
						endpoint: "endpoint2",
						numMaxClients: 5,
						reservationEndpoint: "reservation2",
					}),
				}),
			} as unknown as RedisCommander;
			aliveMonitoring = new AliveMonitoringRedis(redisClient);
		});

		it("should return processes by trait", async () => {
			const processes = await aliveMonitoring.findProcessByTrait("trait1");

			expect(processes).toHaveLength(2);
			expect(processes[0].id).toBe("process1");
			expect(processes[1].id).toBe("process2");
		});
	});

	describe("getProcess", () => {
		let aliveMonitoring: AliveMonitoringRedis;
		let redisClient: RedisCommander;

		beforeEach(() => {
			redisClient = {
				hget: jest.fn().mockResolvedValue(
					JSON.stringify({
						id: "process1",
						trait: "trait1",
						endpoint: "endpoint1",
						numMaxClients: 10,
						reservationEndpoint: "reservation1",
					}),
				),
			} as unknown as RedisCommander;
			aliveMonitoring = new AliveMonitoringRedis(redisClient);
		});

		it("should return a process by trait and id", async () => {
			const process = await aliveMonitoring.getProcess("trait1", "process1");

			expect(process).toBeDefined();
			expect(process?.id).toBe("process1");
		});

		it("should return null if process does not exist", async () => {
			redisClient.hget = jest.fn().mockResolvedValue(null);
			const process = await aliveMonitoring.getProcess("trait1", "nonexistent");

			expect(process).toBeNull();
		});
	});

	describe("joinProcess", () => {
		let aliveMonitoring: AliveMonitoringRedis;
		let redisClient: RedisCommander;

		beforeEach(() => {
			redisClient = {
				hset: jest.fn().mockResolvedValue(12345),
			} as unknown as RedisCommander;
			aliveMonitoring = new AliveMonitoringRedis(redisClient);
		});

		it("should join a process", async () => {
			const process = {
				id: "process1",
				trait: "trait1",
				endpoint: "endpoint1",
				numMaxClients: 10,
				reservationEndpoint: "reservation1",
			};

			await expect(aliveMonitoring.joinProcess(process)).resolves.toBeUndefined();
		});
	});

	describe("leaveProcess", () => {
		let aliveMonitoring: AliveMonitoringRedis;
		let redisClient: RedisCommander;

		beforeEach(() => {
			redisClient = {
				hdel: jest.fn().mockResolvedValue(12345),
			} as unknown as RedisCommander;
			aliveMonitoring = new AliveMonitoringRedis(redisClient);
		});

		it("should leave a process", async () => {
			const process = {
				id: "process1",
				trait: "trait1",
				endpoint: "endpoint1",
				numMaxClients: 10,
				reservationEndpoint: "reservation1",
			};

			await expect(aliveMonitoring.leaveProcess(process)).resolves.toBeUndefined();
		});
	});
});
