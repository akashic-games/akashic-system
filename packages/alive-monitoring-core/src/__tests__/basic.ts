import config from "config";
import { default as IORedis } from "ioredis";

//
import * as AliveMonitoringCore from "../";

describe("with redis", () => {
	test("with redis", async () => {
		const redisClient = new IORedis(config.get("redis.port"), config.get("redis.host"), config.get("redis.option"));

		const process1: AliveMonitoringCore.ProcessLike = {
			id: "dog",
			trait: "standard_websocket",
			endpoint: "ws://redis.the.endpoint.net",
			numMaxClients: 5,
			reservationEndpoint: "http://redis.internal.endpoint.net",
		};

		const aliveMonitoringRedis = new AliveMonitoringCore.AliveMonitoringRedis(redisClient);

		// join したら、
		await aliveMonitoringRedis.joinProcess(process1);
		// その分が増える
		const processLength = (await aliveMonitoringRedis.findProcessByTrait(process1.trait)).length;
		expect(processLength).toBeGreaterThanOrEqual(1);
		// 追加したやつは取得できる
		const getProcessResult = await aliveMonitoringRedis.getProcess(process1.trait, process1.id);
		expect(getProcessResult!.id).toBe(process1.id);
		expect(getProcessResult!.trait).toBe(process1.trait);
		expect(getProcessResult!.endpoint).toBe(process1.endpoint);
		expect(getProcessResult!.reservationEndpoint).toBe(process1.reservationEndpoint);

		// leave したら、
		await aliveMonitoringRedis.leaveProcess(process1);
		// leave した分だけ少なくなってる
		expect((await aliveMonitoringRedis.findProcessByTrait("standard_websocket")).length).toBeLessThan(processLength);
		// 当然、
		const getProcessResultAfterLeave = await aliveMonitoringRedis.getProcess("standard_websocket", process1.id);
		expect(getProcessResultAfterLeave).toBeNull();

		redisClient.quit();
	});
});
