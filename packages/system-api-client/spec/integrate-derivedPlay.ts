import config from "config";
import { SystemApiClient } from "../src";
import { InstanceModule, Play } from "../src/DataTypes";

describe("Derived Play", () => {
	let client: SystemApiClient;
	let originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
	const base = config.get<string>("service.baseUrl");
	const retryCount = config.get<number>("retry");
	const maxTimeout = config.get<number>("maxTimeout");

	beforeEach(() => {
		client = new SystemApiClient(base);
		originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
		jasmine.DEFAULT_TIMEOUT_INTERVAL = maxTimeout;
	});

	afterEach(() => {
		jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
	});

	const gameCode = "oekaki";
	const parentData = "gqh0aWNrTGlzdJMAzMiQq3N0YXJ0UG9pbnRzkYKlZnJhbWUApGRhdGGBpHNlZWTOB1vNFQ==";

	function createParentPlay(): Promise<string> {
		let playId: string;
		let instanceId: string;
		return client
			.createPlay(gameCode)
			.then((res) => {
				expect(res.meta.status).toBe(200);
				expect(Number(res.data.id)).toBeGreaterThan(0);
				playId = res.data.id;
				// 派生元プレーでインスタンス起動
				const modules: InstanceModule[] = [
					{
						code: "dynamicPlaylogWorker",
						values: { playId, executionMode: "active" },
					},
					{
						code: "akashicEngineParameters",
						values: {
							gameConfigurations: ["games/oekaki/1.0/game.json"],
						},
					},
				];
				return client.createInstance(gameCode, modules, 1, "engines/akashic/v1.0/entry.js");
			})
			.then((res) => {
				expect(res.meta.status).toBe(200);
				expect(Number(res.data.id)).toBeGreaterThan(0);
				instanceId = res.data.id;
				// playlog が書かれているであろうと思われる時間待つ
				return new Promise((resolve, reject) => {
					setTimeout(() => {
						resolve();
					}, 5000);
				});
			})
			.then(() => {
				// インスタンス終了
				return client.deleteInstance(instanceId);
			})
			.then((res) => {
				// プレー終了
				expect(res.meta.status).toBe(200);
				return client.stopPlay(playId);
			})
			.then((res) => {
				expect(res.meta.status).toBe(200);
				return playId;
			});
	}

	it("過去のプレーから派生プレーを作成できる", (done) => {
		let parentId: string;
		let derivedId: string;
		let parentData: string;
		createParentPlay()
			.then((playId) => {
				parentId = playId;
				return client.createPlay({ parent: { playId } });
			})
			.then((res) => {
				expect(res.meta.status).toBe(200);
				expect(Number(res.data.id)).toBeGreaterThan(0);
				expect(res.data.gameCode).toBe(gameCode);
				expect(res.data.parentId).toBe(parentId);
				derivedId = res.data.id;
				return client.stopPlay(res.data.id);
			})
			.then((res) => {
				// プレーログデータの比較
				expect(res.meta.status).toBe(200);
				return client.getPlaylog(parentId);
			})
			.then((res) => {
				expect(res.meta.status).toBe(200);
				parentData = res.data;
				return client.getPlaylog(derivedId);
			})
			.then((res) => {
				expect(res.meta.status).toBe(200);
				expect(res.data).toEqual(parentData);
				done();
			})
			.catch(done.fail);
	});

	it("プレーログデータから派生プレーを作成できる", (done) => {
		// parentData の 100 フレーム目までのデータ
		const expectedData = "gqh0aWNrTGlzdJIAZKtzdGFydFBvaW50c5GCpWZyYW1lAKRkYXRhgaRzZWVkzgdbzRU=";
		client
			.createPlay({ gameCode, parent: { playData: parentData, frame: 100 } })
			.then((res) => {
				expect(res.meta.status).toBe(200);
				expect(Number(res.data.id)).toBeGreaterThan(0);
				expect(res.data.gameCode).toBe(gameCode);
				expect(res.data.parentId).toBeFalsy();
				return client.stopPlay(res.data.id);
			})
			.then((res) => {
				expect(res.meta.status).toBe(200);
				return client.getPlaylog(res.data.id);
			})
			.then((res) => {
				expect(res.meta.status).toBe(200);
				expect(res.data).toEqual(expectedData);
				done();
			})
			.catch(done.fail);
	});

	it("存在しないプレーからの派生プレー作成は 404 が返る", (done) => {
		client
			.createPlay({ parent: { playId: "0" } })
			.then((res) => {
				done.fail();
			})
			.catch((err) => {
				expect(err.body.meta.status).toBe(404);
				done();
			});
	});

	it("不正なプレーデータからの派生プレー作成は 400 が返る", (done) => {
		client
			.createPlay({ gameCode, parent: { playData: "hoge" } })
			.then((res) => {
				done.fail();
			})
			.catch((err) => {
				expect(err.body.meta.status).toBe(400);
				done();
			});
	});

	it("gameCode を指定無しでプレーデータからの派生プレー作成は 400 が返る", (done) => {
		client
			.createPlay({ parent: { playData: parentData } })
			.then((res) => {
				done.fail();
			})
			.catch((err) => {
				expect(err.body.meta.status).toBe(400);
				done();
			});
	});
});
