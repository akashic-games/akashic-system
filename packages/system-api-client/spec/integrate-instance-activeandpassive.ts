import { NicoApiResponse } from "@akashic/rest-client-core";
import config from "config";
import { Instance, InstanceModule, PagingResponse, SystemApiClient } from "../src";
import { waitAndRun } from "../src/util";

describe("instance-active and passive", () => {
	let client: SystemApiClient;
	let originalTimeout: number;
	const base = config.get<string>("service.baseUrl");
	const retryCount = config.get<number>("retry");
	const maxTimeout = config.get<number>("maxTimeout");

	function path(p: string) {
		return p.substr(base.length);
	}

	beforeEach(() => {
		client = new SystemApiClient(base);
		originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
		jasmine.DEFAULT_TIMEOUT_INTERVAL = maxTimeout;
	});

	afterEach(() => {
		jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
	});

	const intgGameCode = "1";
	const intgRegion = "akashicCluster";
	const intgCost = 1;
	const intgEntryPoint = "engines/akashic/v1.0/entry.js";
	const intgOekakiAkashicEngineParams = {
		code: "akashicEngineParameters",
		values: {
			gameConfigurations: ["games/oekaki/1.0/game.json"],
		},
	};

	// ■■■ インスタンス - /plays/:id/instances ■■■
	it("createPassiveAEInstanceAfterCreateActiveAEInstance", (done) => {
		let playId: string;
		let instanceId: string;
		let videoInstanceId: string;
		client
			.createPlay(intgGameCode)
			.then((res) => {
				// プレー作る
				expect(res.meta.status).toBe(200);
				expect(Number(res.data.id)).toBeGreaterThan(0);
				playId = res.data.id;
				// インスタンス一覧取得
				return client.findPlayInstances(playId);
			})
			.then((res) => {
				expect(res.meta.status).toBe(200);
				expect(res.data.values.length).toBe(0);
				const modules: InstanceModule[] = [
					{
						code: "dynamicPlaylogWorker",
						values: {
							playId,
							executionMode: "active",
						},
					},
					{
						code: "videoPublisher",
						values: {
							videoPublishUri: "rtmp://10.141.0.216/live/integrate-" + playId,
							videoFrameRate: 10,
						},
					},
					intgOekakiAkashicEngineParams,
				];
				// Active AEインスタンス作る
				return client.createInstance(intgGameCode, modules, intgCost, intgEntryPoint);
			})
			.then((res) => {
				expect(res.meta.status).toBe(200);
				expect(res.data.id).toBeGreaterThan(0);
				instanceId = res.data.id;
				// インスタンス一覧取得
				return client.findPlayInstances(playId);
			})
			.then((res) => {
				// statusがrunningに切り替わるまで時間がかかるので少し待つ
				return new Promise<NicoApiResponse<PagingResponse<Instance>>>((resolve, reject) => {
					setTimeout(() => {
						resolve(res);
					}, 1000);
				});
			})
			.then((res) => {
				expect(res.data.values.length).toBe(1);
				expect(res.data.values[0].id).toBe(instanceId);
				// インスタンス単体取得
				return (
					waitAndRun(retryCount, 2000, () =>
						client.getInstance(instanceId).then((res) => {
							expect(res.meta.status).toBe(200);
							expect(res.data.status).toBe("running");
							expect(res.data.id).toBe(instanceId);
							expect(res.data.region).toBe(intgRegion);
							expect(res.data.gameCode).toEqual(intgGameCode);
							expect(res.data.cost).toEqual(intgCost);
							expect(res.data.entryPoint).toEqual(intgEntryPoint);
						}),
					)
						// Passive AE with Videoのインスタンス作る
						.then(() => {
							const modules: InstanceModule[] = [
								{
									code: "dynamicPlaylogWorker",
									values: {
										playId,
										executionMode: "passive",
									},
								},
								{
									code: "videoPublisher",
									values: {
										videoPublishUri: "rtmp://10.141.0.216/live/test" + playId,
										videoFrameRate: 10,
									},
								},
								intgOekakiAkashicEngineParams,
							];
							return client.createInstance(intgGameCode, modules, intgCost, intgEntryPoint);
						})
				);
			})
			.then((res) => {
				videoInstanceId = res.data.id;
				// インスタンス削除
				return client.deleteInstance(instanceId);
			})
			.then((res) => {
				expect(res.meta.status).toBe(200);
				// Passive AE with Videoのインスタンス削除
				return client.deleteInstance(videoInstanceId);
			})
			.then((deleteResponse) => {
				expect(deleteResponse.meta.status).toBe(200);
				return waitAndRun(retryCount, 2000, () =>
					client.getInstance(instanceId).then((res) => {
						expect(res.meta.status).toBe(200);
						expect(res.data.id).toBe(instanceId);
						expect(res.data.status).toBe("closed");
					}),
				);
			})
			.then(() => {
				return waitAndRun(retryCount, 2000, () =>
					client.getInstance(videoInstanceId).then((res) => {
						expect(res.meta.status).toBe(200);
						expect(res.data.id).toBe(videoInstanceId);
						expect(res.data.status).toBe("closed");
						done();
					}),
				);
			})
			.catch((err) => {
				console.log("create active and passive instances error", err);
				done.fail(err);
			});
	});

	// ActiveAEを二つ作る
	// ActiveAEとPassiveAEを一つずつ作る
	// PassiveAEを二つ作る
});
