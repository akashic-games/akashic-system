import { NicoApiResponse } from "@akashic/rest-client-core";
import config from "config";
import { InstanceModule, SystemApiClient } from "../src";
import { FindInstanceRequest, Instance as InstanceType, InstanceModule as InstanceModuleType, Play } from "../src/DataTypes";
import { waitAndRun } from "../src/util";

describe("Instance#DynamicPlaylogWorker", () => {
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

	const intgGameCode = "oekaki";
	const intgRegion = "akashicCluster";
	const intgCost = 1;
	const intgEntryPoint = "engines/akashic/v1.0/entry.js";
	const intgOekakiAkashicEngineParams = {
		code: "akashicEngineParameters",
		values: {
			gameConfigurations: ["games/oekaki/1.0/game.json"],
		},
	};

	function createInstanceTest(
		done: any,
		executionMode: string,
		gameCode: string,
		mod: InstanceModule[],
		cost: number,
		entryPoint: string,
		acceptErrorState?: boolean,
		postProcess?: any,
	) {
		let playId: string;
		let instanceId: string;
		client
			.createPlay(gameCode)
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
						values: { playId, executionMode },
					},
					{
						code: "eventHandlers",
						values: {
							handlers: [
								{
									type: "error",
									endpoint: "http://example.jp/somewhere/",
									protocol: "http",
								},
								{
									type: "instanceStatus",
									endpoint: "http://example.jp/somewhere/",
									protocol: "http",
								},
								{
									type: "gameEvent",
									endpoint: "http://example.jp/somewhere/",
									protocol: "http",
								},
							],
						},
					},
					intgOekakiAkashicEngineParams,
				];
				Array.prototype.push.apply(
					modules,
					mod.map((m) => {
						if (m.code !== "videoPublisher") {
							return m;
						}
						m.values.videoPublishUri += playId;
						return m;
					}),
				);
				// インスタンス作る
				return client.createInstance(gameCode, modules, cost, entryPoint);
			})
			.then((res) => {
				expect(res.meta.status).toBe(200);
				expect(res.data.id).toBeGreaterThan(0);
				instanceId = res.data.id;
				// インスタンス一覧取得
				return client.findPlayInstances(playId);
			})
			.then((res) => {
				expect(res.data.values.length).toBe(1);
				expect(res.data.values[0].id).toBe(instanceId);
				// インスタンス単体取得
				return waitAndRun(retryCount, 3000, () =>
					client.getInstance(instanceId).then((res) => {
						expect(res.meta.status).toBe(200);
						if (!acceptErrorState) {
							expect(res.data.status).toBe("running");
						}
						expect(res.data.id).toBe(instanceId);
						expect(res.data.region).toBe(intgRegion);
						expect(res.data.gameCode).toEqual(gameCode);
						expect(res.data.cost).toEqual(cost);
						expect(res.data.entryPoint).toEqual(entryPoint);
						expect(res.data.processName).toContain("gameRunner2");
					}),
				);
			})
			.then(() => {
				// インスタンス検索
				return waitAndRun(retryCount, 3000, () =>
					client
						.findInstance({
							gameCode,
							_offset: 0,
							_limit: 10,
						})
						.then((res) => {
							expect(res.meta.status).toBe(200);
							const instancesList = res.data.values;
							expect(instancesList.length).toBeLessThan(11);
							instancesList.forEach((value) => {
								expect(value.gameCode).toEqual(gameCode);
							});
						}),
				);
			})
			.then(() => {
				// インスタンス削除
				return client.deleteInstance(instanceId);
			})
			.then((deleteResponse) => {
				expect(deleteResponse.meta.status).toBe(200);
				return waitAndRun(retryCount, 3000, () =>
					client.getInstance(instanceId).then((res) => {
						expect(res.meta.status).toBe(200);
						expect(res.data.id).toBe(instanceId);
						if (!acceptErrorState) {
							expect(res.data.status).toBe("closed");
						}
					}),
				);
			})
			.then(() => {
				// 削除されたインスタンスを削除
				return client.deleteInstance(instanceId);
			})
			.catch((err) => {
				// 409 CONFLICT エラーになるのを確認
				expect(err.name).toEqual("RestClientError");
				expect(err.message).toEqual("CONFLICT");
				expect(err.body.meta.status).toBe(409);
			})
			.then(() => {
				if (postProcess) {
					postProcess(playId, instanceId).then(done, done.fail);
				} else {
					done();
				}
			})
			.catch((err) => {
				console.error(err);
				done.fail(err);
			});
	}

	it("Active AEインスタンス, 映像ありを作成できる", (done) => {
		createInstanceTest(
			done,
			"active",
			intgGameCode,
			[
				{
					code: "videoPublisher",
					values: {
						videoPublishUri: "rtmp://10.141.0.216/live/integrate-active-play",
						videoFrameRate: 10,
					},
				},
			],
			intgCost,
			intgEntryPoint,
		);
	});

	it("Passive AEインスタンス, 映像ありを作成できる", (done) => {
		createInstanceTest(
			done,
			"passive",
			intgGameCode,
			[
				{
					code: "videoPublisher",
					values: {
						videoPublishUri: "rtmp://10.141.0.216/live/integrate-passive-play",
						videoFrameRate: 10,
					},
				},
			],
			intgCost,
			intgEntryPoint,
			true, // Active AE が存在せず、一定時間後にエラー終了になるため、エラー状態も許容
		);
	});

	it("Active AEインスタンス, 映像なしを作成できる", (done) => {
		createInstanceTest(done, "active", intgGameCode, [], intgCost, intgEntryPoint);
	});

	it("Passive AEインスタンス, 映像なしを作成できる", (done) => {
		createInstanceTest(
			done,
			"passive",
			intgGameCode,
			[],
			intgCost,
			intgEntryPoint,
			true, // Active AE が存在せず、一定時間後にエラー終了になるため、エラー状態も許容
		);
	});

	// ActiveAEを二つ作る
	// ActiveAEとPassiveAEを一つずつ作る
	// PassiveAEを二つ作る
});

describe("Instance#StaticPlayLogWorker", () => {
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
	interface StaticPlayLogValue {
		playId?: string;
		playData?: string;
	}

	const intgGameCode = "oekaki";
	const intgRegion = "akashicCluster";
	const intgCost = 1;
	const intgEntryPoint = "engines/akashic/v1.0/entry.js";
	const intgOekakiAkashicEngineParams = {
		code: "akashicEngineParameters",
		values: {
			gameConfigurations: ["games/oekaki/1.0/game.json"],
		},
	};

	const staticPlayData: StaticPlayLogValue = {
		playData: "gqh0aWNrTGlzdJMAy0M/////////kKtzdGFydFBvaW50c5GCpWZyYW1lAKRkYXRhgaRzZWVkzgdbzRU=",
	};
	const staticPlayId: StaticPlayLogValue = { playId: "1" };

	function createStaticPlaylogTest(
		done: any,
		gameCode: string,
		mod: InstanceModule[],
		cost: number,
		entryPoint: string,
		playLogValue: StaticPlayLogValue,
		acceptErrorState?: boolean,
	) {
		let instanceId: string;
		const modules: InstanceModule[] = [
			{
				code: "staticPlaylogWorker",
				values: { playlog: playLogValue, loop: true },
			},
			{
				code: "eventHandlers",
				values: {
					handlers: [
						{
							type: "error",
							endpoint: "http://example.jp/somewhere/",
							protocol: "http",
						},
						{
							type: "instanceStatus",
							endpoint: "http://example.jp/somewhere/",
							protocol: "http",
						},
						{
							type: "gameEvent",
							endpoint: "http://example.jp/somewhere/",
							protocol: "http",
						},
					],
				},
			},
			intgOekakiAkashicEngineParams,
		];

		const appendPublishUri = playLogValue.playId ? playLogValue.playId : playLogValue.playData ? playLogValue.playData.substr(0, 8) : "";
		Array.prototype.push.apply(
			modules,
			mod.map((m) => {
				if (m.code !== "videoPublisher") {
					return m;
				}
				m.values.videoPublishUri += appendPublishUri;
				return m;
			}),
		);
		// インスタンス作る
		client
			.createInstance(gameCode, modules, cost, entryPoint)
			.then((res) => {
				expect(res.meta.status).toBe(200);
				expect(res.data.id).toBeGreaterThan(0);
				instanceId = res.data.id;
				// インスタンス単体取得
				return waitAndRun(retryCount, 3000, () =>
					client.getInstance(instanceId).then((res) => {
						expect(res.meta.status).toBe(200);
						if (!acceptErrorState) {
							expect(res.data.status).toBe("running");
						}
						expect(res.data.id).toBe(instanceId);
						expect(res.data.region).toBe(intgRegion);
						expect(res.data.gameCode).toEqual(gameCode);
						expect(res.data.cost).toEqual(cost);
						expect(res.data.entryPoint).toEqual(entryPoint);
						expect(res.data.processName).toContain("gameRunner2");
					}),
				);
			})
			.then(() => {
				// インスタンス削除
				return waitAndRun(retryCount, 3000, () =>
					client
						.findInstance({
							gameCode,
							_offset: 0,
							_limit: 10,
						})
						.then((res) => {
							expect(res.meta.status).toBe(200);
							const instancesList = res.data.values;
							expect(instancesList.length).toBeLessThan(11);
							instancesList.forEach((value) => {
								expect(value.gameCode).toEqual(gameCode);
							});
						}),
				);
			})
			.then(() => {
				// インスタンス削除
				return client.deleteInstance(instanceId);
			})
			.then((deleteResponse) => {
				expect(deleteResponse.meta.status).toBe(200);
				return waitAndRun(retryCount, 3000, () =>
					client.getInstance(instanceId).then((res) => {
						expect(res.meta.status).toBe(200);
						expect(res.data.id).toBe(instanceId);
						if (!acceptErrorState) {
							expect(res.data.status).toBe("closed");
						}
					}),
				);
			})
			.then(() => {
				done();
			})
			.catch((err) => {
				console.error(err);
				done.fail(err);
			});
	}

	it("staticPlaylog#playId, 映像ありを作成できる", (done) => {
		createStaticPlaylogTest(
			done,
			intgGameCode,
			[
				{
					code: "videoPublisher",
					values: {
						videoPublishUri: "rtmp://10.141.0.216/live/integrate-static-play",
						videoFrameRate: 10,
					},
				},
			],
			intgCost,
			intgEntryPoint,
			staticPlayId,
			true, // 指定した playId のデータが存在しない場合もあるため、エラー状態も許容
		);
	});

	it("staticPlaylog#playId, 映像なしを作成できる", (done) => {
		createStaticPlaylogTest(
			done,
			intgGameCode,
			[],
			intgCost,
			intgEntryPoint,
			staticPlayId,
			true, // 指定した playId のデータが存在しない場合もあるため、エラー状態も許容
		);
	});

	it("staticPlaylog#playData, 映像ありを作成できる", (done) => {
		createStaticPlaylogTest(
			done,
			intgGameCode,
			[
				{
					code: "videoPublisher",
					values: {
						videoPublishUri: "rtmp://10.141.0.216/live/integrate-static-play",
						videoFrameRate: 10,
					},
				},
			],
			intgCost,
			intgEntryPoint,
			staticPlayData,
		);
	});

	it("staticPlaylog#playData, 映像なしを作成できる", (done) => {
		createStaticPlaylogTest(done, intgGameCode, [], intgCost, intgEntryPoint, staticPlayData);
	});
});

describe("Instance#FindInstance", () => {
	let client: SystemApiClient;
	let originalTimeout: number;
	const base = config.get<string>("service.baseUrl");
	const retryCount = config.get<number>("retry");
	const maxTimeout = config.get<number>("maxTimeout");

	const deleteInstancesIdList: string[] = [];
	const deletePlayIdList: string[] = [];

	const findGameCodeOekaki = "oekaki";
	const findVideoPubOekaki = "rtmp://10.141.0.216/live/photoshop";
	const findEntryPointAkashicE = "engines/akashic/v1.0/entry.js";
	const findStatusRunning = "running";
	let findProcessName = "akashicDummyProcess";
	const findLimit = 25;
	const akashicEngineParamOekaki: InstanceModuleType = {
		code: "akashicEngineParameters",
		values: {
			gameConfigurations: ["games/oekaki/1.0/game.json"],
		},
	};
	const akashicEngineParamShikabane: InstanceModuleType = {
		code: "akashicEngineParameters",
		values: {
			gameConfigurations: ["games/shikabane-jump/1.0/game.json"],
		},
	};

	interface InstanceParams {
		gameCode: string;
		videoPublishUri: string;
		entryPoint: string;
		engineParamModule: InstanceModuleType;
		isDeleteInstance: boolean; // closedなインスタンスも欲しいので、止めたいやつはtrue
	}

	function createSearchInstance(params: InstanceParams[]) {
		return Promise.all(
			params.map((value) => {
				return client
					.createPlay(value.gameCode)
					.then((response) => {
						const modules = [
							{
								code: "dynamicPlaylogWorker",
								values: {
									playId: response.data.id,
									executionMode: "active",
								},
							},
							{
								code: "videoPublisher",
								values: {
									videoPublishUri: value.videoPublishUri,
									videoFrameRate: 10,
								},
							},
							value.engineParamModule,
						];
						deletePlayIdList.push(response.data.id);
						return client.createInstance(value.gameCode, modules, 1, value.entryPoint);
					})
					.then<NicoApiResponse<InstanceType>>((response) => {
						// すぐに終了させると割り当てが行われる前に終了し、
						// game-runner が確定しない状態で終わることがあるので
						// 待ちを入れる
						return new Promise((resolve, reject) => {
							setTimeout(() => {
								resolve(response);
							}, 2000);
						});
					})
					.then((response) => {
						if (value.isDeleteInstance === true) {
							return client.deleteInstance(response.data.id).then(() => response.data.id);
						}
						// 止めてないやつは、後で止めるものとして入れておく
						deleteInstancesIdList.push(response.data.id);
						return Promise.resolve(response.data.id);
					});
			}),
		);
	}

	const integrateFindInstanceParams: InstanceParams[] = [
		{
			gameCode: "oekaki",
			videoPublishUri: "rtmp://10.141.0.216/live/photoshop/integrate-test",
			entryPoint: findEntryPointAkashicE,
			engineParamModule: akashicEngineParamOekaki,
			isDeleteInstance: false,
		},
		{
			gameCode: "oekaki",
			videoPublishUri: "rtmp://10.141.0.216/live/mspaint/integrate-test",
			entryPoint: findEntryPointAkashicE,
			engineParamModule: akashicEngineParamOekaki,
			isDeleteInstance: false,
		},
		{
			gameCode: "shikabane-jump",
			videoPublishUri: "rtmp://10.141.0.216/live/shikabane/integrate-test",
			entryPoint: findEntryPointAkashicE,
			engineParamModule: akashicEngineParamShikabane,
			isDeleteInstance: false,
		},
		{
			gameCode: "shikabane-jump",
			videoPublishUri: "rtmp://10.141.0.216/live/shikabane/integrate-test",
			entryPoint: findEntryPointAkashicE,
			engineParamModule: akashicEngineParamShikabane,
			isDeleteInstance: false,
		},
		{
			gameCode: "oekaki",
			videoPublishUri: "rtmp://10.141.0.216/live/photoshop/integrate-test",
			entryPoint: findEntryPointAkashicE,
			engineParamModule: akashicEngineParamOekaki,
			isDeleteInstance: true,
		},
		{
			gameCode: "shikabane-jump",
			videoPublishUri: "rtmp://10.141.0.216/live/shikabane/integrate-test",
			entryPoint: findEntryPointAkashicE,
			engineParamModule: akashicEngineParamShikabane,
			isDeleteInstance: true,
		},
	];

	function createFindParams(args: FindInstanceRequest): FindInstanceRequest {
		return {
			gameCode: args.gameCode,
			status: args.status,
			entryPoint: args.entryPoint,
			videoPublishUri: args.videoPublishUri,
			processName: args.processName,
			_offset: 0,
			_limit: findLimit,
			_count: args._count ? args._count : 0,
		};
	}

	// 対象のcodeと一致するmoduleだけを取ってくる
	function getModuleArrayByCode(instances: InstanceType[], code: string): InstanceModule[] {
		const instanceModuleArray: InstanceModuleType[][] = instances.map((value) => value.modules);
		return instanceModuleArray.map((value) => {
			const filterd = value.filter((value2) => value2.code === code);
			return filterd[0];
		});
	}

	// videoPublisherのUriだけの配列にする
	function getVideoPublishUriArray(instances: InstanceType[]) {
		const moduleArray = getModuleArrayByCode(instances, "videoPublisher");
		return moduleArray.map((value) => value.values.videoPublishUri);
	}

	beforeAll((done) => {
		client = new SystemApiClient(base);
		originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
		jasmine.DEFAULT_TIMEOUT_INTERVAL = maxTimeout;
		createSearchInstance(integrateFindInstanceParams)
			// processName は外部から指定出来るものではないので、取得しに行ってみる
			.then((instances) => client.getInstance(instances[0]))
			.then((response) => {
				expect(response.meta.status).toEqual(200);
				const instance = response.data;
				const gameRunnerStr = "gameRunner";
				const grIndexOf = instance.processName.indexOf(gameRunnerStr);
				findProcessName = instance.processName.substr(0, grIndexOf + gameRunnerStr.length);
				console.log("integrate-test use processName: ", findProcessName);
				done();
			})
			.catch((error) => {
				console.log("beforeAll failed", error);
				fail(error);
			});
	});

	afterAll((done) => {
		const deleteInst = deleteInstancesIdList.map((value) => client.deleteInstance(value));
		const deletePlay = deletePlayIdList.map((value) => client.deletePlay(value));
		Promise.all(deleteInst)
			.then(() => Promise.all(deletePlay))
			.then(() => {
				jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
				done();
			})
			.catch((error) => fail(error));
	});

	it("gameCodeを指定し、条件と合致するインスタンスを検索できる", (done) => {
		const searchParams = createFindParams({ gameCode: findGameCodeOekaki });
		client.findInstance(searchParams).then((response) => {
			expect(response.meta.status).toEqual(200);
			const instances: InstanceType[] = response.data.values;
			expect(instances.length).toBeGreaterThan(0);
			expect(instances.every((value) => value.gameCode === findGameCodeOekaki)).toBeTruthy();
			done();
		});
	});

	it("statusを指定し、条件と合致するインスタンスを検索できる", (done) => {
		const searchParams = createFindParams({ status: [findStatusRunning] });
		client.findInstance(searchParams).then((response) => {
			expect(response.meta.status).toEqual(200);
			const instances: InstanceType[] = response.data.values;
			expect(instances.length).toBeGreaterThan(0);
			expect(instances.every((value) => value.status === findStatusRunning)).toBeTruthy();
			done();
		});
	});

	it("entryPointを指定し、条件と合致するインスタンスを検索できる", (done) => {
		const searchParams = createFindParams({ entryPoint: findEntryPointAkashicE });
		client.findInstance(searchParams).then((response) => {
			expect(response.meta.status).toEqual(200);
			const instances: InstanceType[] = response.data.values;
			expect(instances.length).toBeGreaterThan(0);
			expect(instances.every((value) => value.entryPoint.indexOf(findEntryPointAkashicE) === 0)).toBeTruthy();
			done();
		});
	});

	it("videoPublishUriを指定し、条件と合致するインスタンスを検索できる", (done) => {
		const searchParams = createFindParams({ videoPublishUri: findVideoPubOekaki });
		client.findInstance(searchParams).then((response) => {
			expect(response.meta.status).toEqual(200);
			const instances: InstanceType[] = response.data.values;
			expect(instances.length).toBeGreaterThan(0);
			const publishUriArray = getVideoPublishUriArray(instances);
			expect(publishUriArray.every((value) => value.indexOf(findVideoPubOekaki) === 0)).toBeTruthy();
			done();
		});
	});

	it("processNameを指定し、条件と合致するインスタンスを検索できる", (done) => {
		const searchParams = createFindParams({ processName: findProcessName });
		client.findInstance(searchParams).then((response) => {
			expect(response.meta.status).toEqual(200);
			const instances: InstanceType[] = response.data.values;
			expect(instances.length).toBeGreaterThan(0);
			expect(instances.every((value) => value.processName.indexOf(findProcessName) === 0)).toBeTruthy();
			done();
		});
	});

	it("gameCode, status を指定し、条件と合致するインスタンスを検索できる", (done) => {
		const searchParams = createFindParams({
			gameCode: findGameCodeOekaki,
			status: [findStatusRunning],
		});
		client.findInstance(searchParams).then((response) => {
			expect(response.meta.status).toEqual(200);
			const instances: InstanceType[] = response.data.values;
			expect(instances.length).toBeGreaterThan(0);
			expect(instances.every((value) => value.gameCode === findGameCodeOekaki && value.status === findStatusRunning)).toBeTruthy();
			done();
		});
	});

	it("gameCode, entryPoint を指定し、条件と合致するインスタンスを検索できる", (done) => {
		const searchParams = createFindParams({
			gameCode: findGameCodeOekaki,
			entryPoint: findEntryPointAkashicE,
		});
		client.findInstance(searchParams).then((response) => {
			expect(response.meta.status).toEqual(200);
			const instances: InstanceType[] = response.data.values;
			expect(instances.length).toBeGreaterThan(0);
			expect(
				instances.every((value) => value.gameCode === findGameCodeOekaki && value.entryPoint.indexOf(findEntryPointAkashicE) === 0),
			).toBeTruthy();
			done();
		});
	});

	it("gameCode, videoPublishUri を指定し、条件と合致するインスタンスを検索できる", (done) => {
		const searchParams = createFindParams({
			gameCode: findGameCodeOekaki,
			videoPublishUri: findVideoPubOekaki,
		});
		client.findInstance(searchParams).then((response) => {
			expect(response.meta.status).toEqual(200);
			const instances: InstanceType[] = response.data.values;
			expect(instances.length).toBeGreaterThan(0);
			expect(instances.every((value) => value.gameCode === findGameCodeOekaki)).toBeTruthy();
			const publishUriArray = getVideoPublishUriArray(instances);
			expect(publishUriArray.every((value) => value.indexOf(findVideoPubOekaki) === 0)).toBeTruthy();
			done();
		});
	});

	it("gameCode, processName を指定し、条件と合致するインスタンスを検索できる", (done) => {
		const searchParams = createFindParams({
			gameCode: findGameCodeOekaki,
			processName: findProcessName,
		});
		client.findInstance(searchParams).then((response) => {
			expect(response.meta.status).toEqual(200);
			const instances: InstanceType[] = response.data.values;
			expect(instances.length).toBeGreaterThan(0);
			expect(
				instances.every((value) => value.gameCode === findGameCodeOekaki && value.processName.indexOf(findProcessName) === 0),
			).toBeTruthy();
			done();
		});
	});

	it("status, entryPoint を指定し、条件と合致するインスタンスを検索できる", (done) => {
		const searchParams = createFindParams({
			status: [findStatusRunning],
			entryPoint: findEntryPointAkashicE,
		});
		client.findInstance(searchParams).then((response) => {
			expect(response.meta.status).toEqual(200);
			const instances: InstanceType[] = response.data.values;
			expect(instances.length).toBeGreaterThan(0);
			expect(
				instances.every((value) => value.status === findStatusRunning && value.entryPoint.indexOf(findEntryPointAkashicE) === 0),
			).toBeTruthy();
			done();
		});
	});

	it("status, videoPublishUri を指定し、条件と合致するインスタンスを検索できる", (done) => {
		const searchParams = createFindParams({
			status: [findStatusRunning],
			videoPublishUri: findVideoPubOekaki,
		});
		client.findInstance(searchParams).then((response) => {
			expect(response.meta.status).toEqual(200);
			const instances: InstanceType[] = response.data.values;
			expect(instances.length).toBeGreaterThan(0);
			expect(instances.every((value) => value.status === findStatusRunning)).toBeTruthy();
			const publishUriArray = getVideoPublishUriArray(instances);
			expect(publishUriArray.every((value) => value.indexOf(findVideoPubOekaki) === 0)).toBeTruthy();
			done();
		});
	});

	it("status, processName を指定し、条件と合致するインスタンスを検索できる", (done) => {
		const searchParams = createFindParams({
			status: [findStatusRunning],
			processName: findProcessName,
		});
		client.findInstance(searchParams).then((response) => {
			expect(response.meta.status).toEqual(200);
			const instances: InstanceType[] = response.data.values;
			expect(instances.length).toBeGreaterThan(0);
			expect(
				instances.every((value) => value.status === findStatusRunning && value.processName.indexOf(findProcessName) === 0),
			).toBeTruthy();
			done();
		});
	});

	it("entryPoint, videoPublishUri を指定し、条件と合致するインスタンスを検索できる", (done) => {
		const searchParams = createFindParams({
			entryPoint: findEntryPointAkashicE,
			videoPublishUri: findVideoPubOekaki,
		});
		client.findInstance(searchParams).then((response) => {
			expect(response.meta.status).toEqual(200);
			const instances: InstanceType[] = response.data.values;
			expect(instances.length).toBeGreaterThan(0);
			expect(instances.every((value) => value.entryPoint.indexOf(findEntryPointAkashicE) === 0)).toBeTruthy();
			const publishUriArray = getVideoPublishUriArray(instances);
			expect(publishUriArray.every((value) => value.indexOf(findVideoPubOekaki) === 0)).toBeTruthy();
			done();
		});
	});

	it("entryPoint, processName を指定し、条件と合致するインスタンスを検索できる", (done) => {
		const searchParams = createFindParams({
			entryPoint: findEntryPointAkashicE,
			processName: findProcessName,
		});
		client.findInstance(searchParams).then((response) => {
			expect(response.meta.status).toEqual(200);
			const instances: InstanceType[] = response.data.values;
			expect(instances.length).toBeGreaterThan(0);
			expect(
				instances.every(
					(value) => value.entryPoint.indexOf(findEntryPointAkashicE) === 0 && value.processName.indexOf(findProcessName) === 0,
				),
			).toBeTruthy();
			done();
		});
	});

	it("videoPublishUri, processName を指定し、条件と合致するインスタンスを検索できる", (done) => {
		const searchParams = createFindParams({
			processName: findProcessName,
			videoPublishUri: findVideoPubOekaki,
		});
		client.findInstance(searchParams).then((response) => {
			expect(response.meta.status).toEqual(200);
			const instances: InstanceType[] = response.data.values;
			expect(instances.length).toBeGreaterThan(0);
			expect(instances.every((value) => value.processName.indexOf(findProcessName) === 0)).toBeTruthy();
			const publishUriArray = getVideoPublishUriArray(instances);
			expect(publishUriArray.every((value) => value.indexOf(findVideoPubOekaki) === 0)).toBeTruthy();
			done();
		});
	});

	it("gameCode, status, entryPoint を指定し、条件と合致するインスタンスを検索できる", (done) => {
		const searchParams = createFindParams({
			gameCode: findGameCodeOekaki,
			status: [findStatusRunning],
			entryPoint: findEntryPointAkashicE,
		});
		client.findInstance(searchParams).then((response) => {
			expect(response.meta.status).toEqual(200);
			const instances: InstanceType[] = response.data.values;
			expect(instances.length).toBeGreaterThan(0);
			expect(
				instances.every(
					(value) =>
						value.gameCode === findGameCodeOekaki &&
						value.status === findStatusRunning &&
						value.entryPoint.indexOf(findEntryPointAkashicE) === 0,
				),
			).toBeTruthy();
			done();
		});
	});

	it("gameCode, status, videoPublishUri を指定し、条件と合致するインスタンスを検索できる", (done) => {
		const searchParams = createFindParams({
			gameCode: findGameCodeOekaki,
			status: [findStatusRunning],
			videoPublishUri: findVideoPubOekaki,
		});
		client.findInstance(searchParams).then((response) => {
			expect(response.meta.status).toEqual(200);
			const instances: InstanceType[] = response.data.values;
			expect(instances.length).toBeGreaterThan(0);
			expect(instances.every((value) => value.gameCode === findGameCodeOekaki && value.status === findStatusRunning)).toBeTruthy();
			const publishUriArray = getVideoPublishUriArray(instances);
			expect(publishUriArray.every((value) => value.indexOf(findVideoPubOekaki) === 0)).toBeTruthy();
			done();
		});
	});

	it("gameCode, status, processName を指定し、条件と合致するインスタンスを検索できる", (done) => {
		const searchParams = createFindParams({
			gameCode: findGameCodeOekaki,
			status: [findStatusRunning],
			processName: findProcessName,
		});
		client.findInstance(searchParams).then((response) => {
			expect(response.meta.status).toEqual(200);
			const instances: InstanceType[] = response.data.values;
			expect(instances.length).toBeGreaterThan(0);
			expect(
				instances.every(
					(value) =>
						value.gameCode === findGameCodeOekaki && value.status === findStatusRunning && value.processName.indexOf(findProcessName) === 0,
				),
			).toBeTruthy();
			done();
		});
	});

	it("gameCode, entryPoint, videoPublishUri を指定し、条件と合致するインスタンスを検索できる", (done) => {
		const searchParams = createFindParams({
			gameCode: findGameCodeOekaki,
			entryPoint: findEntryPointAkashicE,
			videoPublishUri: findVideoPubOekaki,
		});
		client.findInstance(searchParams).then((response) => {
			expect(response.meta.status).toEqual(200);
			const instances: InstanceType[] = response.data.values;
			expect(instances.length).toBeGreaterThan(0);
			expect(
				instances.every((value) => value.gameCode === findGameCodeOekaki && value.entryPoint.indexOf(findEntryPointAkashicE) === 0),
			).toBeTruthy();
			const publishUriArray = getVideoPublishUriArray(instances);
			expect(publishUriArray.every((value) => value.indexOf(findVideoPubOekaki) === 0)).toBeTruthy();
			done();
		});
	});

	it("gameCode, entryPoint, processName を指定し、条件と合致するインスタンスを検索できる", (done) => {
		const searchParams = createFindParams({
			gameCode: findGameCodeOekaki,
			entryPoint: findEntryPointAkashicE,
			processName: findProcessName,
		});
		client.findInstance(searchParams).then((response) => {
			expect(response.meta.status).toEqual(200);
			const instances: InstanceType[] = response.data.values;
			expect(instances.length).toBeGreaterThan(0);
			expect(
				instances.every(
					(value) =>
						value.gameCode === findGameCodeOekaki &&
						value.entryPoint.indexOf(findEntryPointAkashicE) === 0 &&
						value.processName.indexOf(findProcessName) === 0,
				),
			).toBeTruthy();
			done();
		});
	});

	it("gameCode, videoPublishUri, processName を指定し、条件と合致するインスタンスを検索できる", (done) => {
		const searchParams = createFindParams({
			gameCode: findGameCodeOekaki,
			processName: findProcessName,
			videoPublishUri: findVideoPubOekaki,
		});
		client.findInstance(searchParams).then((response) => {
			expect(response.meta.status).toEqual(200);
			const instances: InstanceType[] = response.data.values;
			expect(instances.length).toBeGreaterThan(0);
			expect(
				instances.every((value) => value.gameCode === findGameCodeOekaki && value.processName.indexOf(findProcessName) === 0),
			).toBeTruthy();
			const publishUriArray = getVideoPublishUriArray(instances);
			expect(publishUriArray.every((value) => value.indexOf(findVideoPubOekaki) === 0)).toBeTruthy();
			done();
		});
	});

	it("status, entryPoint, videoPublishUri を指定し、条件と合致するインスタンスを検索できる", (done) => {
		const searchParams = createFindParams({
			status: [findStatusRunning],
			entryPoint: findEntryPointAkashicE,
			videoPublishUri: findVideoPubOekaki,
		});
		client.findInstance(searchParams).then((response) => {
			expect(response.meta.status).toEqual(200);
			const instances: InstanceType[] = response.data.values;
			expect(instances.length).toBeGreaterThan(0);
			expect(
				instances.every((value) => value.status === findStatusRunning && value.entryPoint.indexOf(findEntryPointAkashicE) === 0),
			).toBeTruthy();
			const publishUriArray = getVideoPublishUriArray(instances);
			expect(publishUriArray.every((value) => value.indexOf(findVideoPubOekaki) === 0)).toBeTruthy();
			done();
		});
	});

	it("status, entryPoint, processName を指定し、条件と合致するインスタンスを検索できる", (done) => {
		const searchParams = createFindParams({
			status: [findStatusRunning],
			entryPoint: findEntryPointAkashicE,
			processName: findProcessName,
		});
		client.findInstance(searchParams).then((response) => {
			expect(response.meta.status).toEqual(200);
			const instances: InstanceType[] = response.data.values;
			expect(instances.length).toBeGreaterThan(0);
			expect(
				instances.every(
					(value) =>
						value.status === findStatusRunning &&
						value.entryPoint.indexOf(findEntryPointAkashicE) === 0 &&
						value.processName.indexOf(findProcessName) === 0,
				),
			).toBeTruthy();
			done();
		});
	});

	it("status, videoPublishUri, processName を指定し、条件と合致するインスタンスを検索できる", (done) => {
		const searchParams = createFindParams({
			status: [findStatusRunning],
			processName: findProcessName,
			videoPublishUri: findVideoPubOekaki,
		});
		client.findInstance(searchParams).then((response) => {
			expect(response.meta.status).toEqual(200);
			const instances: InstanceType[] = response.data.values;
			expect(instances.length).toBeGreaterThan(0);
			expect(
				instances.every((value) => value.status === findStatusRunning && value.processName.indexOf(findProcessName) === 0),
			).toBeTruthy();
			const publishUriArray = getVideoPublishUriArray(instances);
			expect(publishUriArray.every((value) => value.indexOf(findVideoPubOekaki) === 0)).toBeTruthy();
			done();
		});
	});

	it("entryPoint, videoPublishUri, processName を指定し、条件と合致するインスタンスを検索できる", (done) => {
		const searchParams = createFindParams({
			entryPoint: findEntryPointAkashicE,
			processName: findProcessName,
			videoPublishUri: findVideoPubOekaki,
		});
		client.findInstance(searchParams).then((response) => {
			expect(response.meta.status).toEqual(200);
			const instances: InstanceType[] = response.data.values;
			expect(instances.length).toBeGreaterThan(0);
			expect(
				instances.every(
					(value) => value.entryPoint.indexOf(findEntryPointAkashicE) === 0 && value.processName.indexOf(findProcessName) === 0,
				),
			).toBeTruthy();
			const publishUriArray = getVideoPublishUriArray(instances);
			expect(publishUriArray.every((value) => value.indexOf(findVideoPubOekaki) === 0)).toBeTruthy();
			done();
		});
	});

	it("gameCode, status, entryPoint, videoPublishUri を指定し、条件と合致するインスタンスを検索できる", (done) => {
		const searchParams = createFindParams({
			gameCode: findGameCodeOekaki,
			status: [findStatusRunning],
			entryPoint: findEntryPointAkashicE,
			videoPublishUri: findVideoPubOekaki,
		});
		client.findInstance(searchParams).then((response) => {
			expect(response.meta.status).toEqual(200);
			const instances: InstanceType[] = response.data.values;
			expect(instances.length).toBeGreaterThan(0);
			expect(
				instances.every(
					(value) =>
						value.gameCode === findGameCodeOekaki &&
						value.status === findStatusRunning &&
						value.entryPoint.indexOf(findEntryPointAkashicE) === 0,
				),
			).toBeTruthy();
			const publishUriArray = getVideoPublishUriArray(instances);
			expect(publishUriArray.every((value) => value.indexOf(findVideoPubOekaki) === 0)).toBeTruthy();
			done();
		});
	});

	it("gameCode, status, entryPoint, processName を指定し、条件と合致するインスタンスを検索できる", (done) => {
		const searchParams = createFindParams({
			gameCode: findGameCodeOekaki,
			status: [findStatusRunning],
			entryPoint: findEntryPointAkashicE,
			processName: findProcessName,
		});
		client.findInstance(searchParams).then((response) => {
			expect(response.meta.status).toEqual(200);
			const instances: InstanceType[] = response.data.values;
			expect(instances.length).toBeGreaterThan(0);
			expect(
				instances.every(
					(value) =>
						value.gameCode === findGameCodeOekaki &&
						value.status === findStatusRunning &&
						value.entryPoint.indexOf(findEntryPointAkashicE) === 0 &&
						value.processName.indexOf(findProcessName) === 0,
				),
			).toBeTruthy();
			done();
		});
	});

	it("gameCode, status, videoPublishUri, processName を指定し、条件と合致するインスタンスを検索できる", (done) => {
		const searchParams = createFindParams({
			gameCode: findGameCodeOekaki,
			status: [findStatusRunning],
			videoPublishUri: findVideoPubOekaki,
			processName: findProcessName,
		});
		client.findInstance(searchParams).then((response) => {
			expect(response.meta.status).toEqual(200);
			const instances: InstanceType[] = response.data.values;
			expect(instances.length).toBeGreaterThan(0);
			expect(
				instances.every(
					(value) =>
						value.gameCode === findGameCodeOekaki && value.status === findStatusRunning && value.processName.indexOf(findProcessName) === 0,
				),
			).toBeTruthy();
			const publishUriArray = getVideoPublishUriArray(instances);
			expect(publishUriArray.every((value) => value.indexOf(findVideoPubOekaki) === 0)).toBeTruthy();
			done();
		});
	});

	it("gameCode, entryPoint, videoPublishUri, processName を指定し、条件と合致するインスタンスを検索できる", (done) => {
		const searchParams = createFindParams({
			gameCode: findGameCodeOekaki,
			entryPoint: findEntryPointAkashicE,
			videoPublishUri: findVideoPubOekaki,
			processName: findProcessName,
		});
		client.findInstance(searchParams).then((response) => {
			expect(response.meta.status).toEqual(200);
			const instances: InstanceType[] = response.data.values;
			expect(instances.length).toBeGreaterThan(0);
			expect(
				instances.every(
					(value) =>
						value.gameCode === findGameCodeOekaki &&
						value.entryPoint.indexOf(findEntryPointAkashicE) === 0 &&
						value.processName.indexOf(findProcessName) === 0,
				),
			).toBeTruthy();
			const publishUriArray = getVideoPublishUriArray(instances);
			expect(publishUriArray.every((value) => value.indexOf(findVideoPubOekaki) === 0)).toBeTruthy();
			done();
		});
	});

	it("status, entryPoint, videoPublishUri, processName を指定し、条件と合致するインスタンスを検索できる", (done) => {
		const searchParams = createFindParams({
			status: [findStatusRunning],
			entryPoint: findEntryPointAkashicE,
			videoPublishUri: findVideoPubOekaki,
			processName: findProcessName,
		});
		client.findInstance(searchParams).then((response) => {
			expect(response.meta.status).toEqual(200);
			const instances: InstanceType[] = response.data.values;
			expect(instances.length).toBeGreaterThan(0);
			expect(
				instances.every(
					(value) =>
						value.status === findStatusRunning &&
						value.entryPoint.indexOf(findEntryPointAkashicE) === 0 &&
						value.processName.indexOf(findProcessName) === 0,
				),
			).toBeTruthy();
			const publishUriArray = getVideoPublishUriArray(instances);
			expect(publishUriArray.every((value) => value.indexOf(findVideoPubOekaki) === 0)).toBeTruthy();
			done();
		});
	});

	it("gameCode, status, entryPoint, videoPublishUri, processName を指定し、条件と合致するインスタンスを検索できる", (done) => {
		const searchParams = createFindParams({
			gameCode: findGameCodeOekaki,
			status: [findStatusRunning],
			entryPoint: findEntryPointAkashicE,
			videoPublishUri: findVideoPubOekaki,
			processName: findProcessName,
		});
		client.findInstance(searchParams).then((response) => {
			expect(response.meta.status).toEqual(200);
			const instances: InstanceType[] = response.data.values;
			expect(instances.length).toBeGreaterThan(0);
			expect(
				instances.every(
					(value) =>
						value.gameCode === findGameCodeOekaki &&
						value.status === findStatusRunning &&
						value.entryPoint.indexOf(findEntryPointAkashicE) === 0 &&
						value.processName.indexOf(findProcessName) === 0,
				),
			).toBeTruthy();
			const publishUriArray = getVideoPublishUriArray(instances);
			expect(publishUriArray.every((value) => value.indexOf(findVideoPubOekaki) === 0)).toBeTruthy();
			done();
		});
	});

	it("条件を指定せず、インスタンスを検索できる", (done) => {
		const searchParams = createFindParams({});
		client.findInstance(searchParams).then((response) => {
			expect(response.meta.status).toEqual(200);
			const instances: InstanceType[] = response.data.values;
			expect(instances.length).toBeGreaterThan(integrateFindInstanceParams.length - 1);
			expect(instances.length).toBeLessThan(findLimit + 1);
			done();
		});
	});

	it("_count=1 を指定すると、条件に一致するインスタンスの総件数が返ってくる", (done) => {
		const searchParams = createFindParams({
			gameCode: findGameCodeOekaki,
			status: [findStatusRunning],
			entryPoint: findEntryPointAkashicE,
			_count: 1,
		});
		client.findInstance(searchParams).then((response) => {
			expect(response.meta.status).toEqual(200);
			const instances: InstanceType[] = response.data.values;
			const totalCount = response.data.totalCount;
			expect(instances.length).toBeLessThan(totalCount + 1);
			expect(instances.length).toBeGreaterThan(0);
			expect(instances.length).toBeLessThan(findLimit + 1);
			done();
		});
	});
});
