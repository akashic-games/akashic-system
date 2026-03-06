import config from "config";
import { SystemApiClient } from "../src";

describe("PlayLogEvent", () => {
	let client: SystemApiClient;
	const base = config.get<string>("service.baseUrl");
	const createPlayGameCode = "1";

	function path(p: string) {
		return p.substr(base.length);
	}

	beforeEach(() => {
		client = new SystemApiClient(base);
	});

	afterEach(() => {});

	interface CreatePlayEvent {
		type: string;
		values: any;
	}

	function createPlayEventTest(done: any, event: CreatePlayEvent) {
		client
			.createPlay(createPlayGameCode)
			.then((res) => {
				expect(res.meta.status).toBe(200);
				expect(res.data.gameCode).toBe(createPlayGameCode);
				expect(res.data.status).toBe("running");
				expect(Number(res.data.id)).toBeGreaterThan(1);
				return client
					.createPlaylogEvent(res.data.id, event)
					.then((res2) => {
						expect(res2.meta.status).toBe(200);
						expect(res2.data).toBeUndefined();
					})
					.then((res3) => {
						return client.deletePlay(res.data.id).then((res3) => {
							expect(res3.meta.status).toBe(200);
							expect(res3.data.status).toBe("suspending");
						});
					})
					.catch((err) => {
						console.log("createPlayEvent error", err);
						done.fail(err);
					});
			})
			.then(done)
			.catch((err) => {
				console.log("createPlay error", err);
				done.fail(err);
			});
	}

	// ■■■ プレーイベント通知API - /plays/:id/events ■■■
	it("作成済みプレーに、JoinPlayerイベントを通知できる", (done) => {
		const event = {
			type: "JoinPlayer",
			values: {
				userId: "12345",
				name: "spec-san",
			},
		};
		createPlayEventTest(done, event);
	});
	it("作成済みプレーに、LeavePlayerイベントを通知できる", (done) => {
		const event = {
			type: "LeavePlayer",
			values: {
				userId: "12345",
			},
		};
		createPlayEventTest(done, event);
	});
});
