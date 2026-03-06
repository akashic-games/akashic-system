import { NicoApiResponse } from "@akashic/rest-client-core";
import config from "config";
import { EmptyResponse, PlayToken, SystemApiClient } from "../src";

describe("token", function () {
	let client: SystemApiClient;
	let dynamicDispatchingClient: SystemApiClient;
	const base = config.get<string>("service.baseUrl");

	beforeEach(() => {
		client = new SystemApiClient(config.get<string>("service.baseUrl"));
		dynamicDispatchingClient = new SystemApiClient(config.get<string>("dispatchingSystemAPIServer.baseUrl"));
	});

	afterEach(function () {});
	// ■■■ プレーAPI（GETのみ） - /plays ■■■
	// プレー作成
	it("createPlay", (done) => {
		let playId: string;
		const tokens: PlayToken[] = [];
		client
			.createPlay("game1")
			.then((res) => {
				// プレー作る
				expect(res.meta.status).toBe(200);
				expect(Number(res.data.id)).toBeGreaterThan(0);
				playId = res.data.id;
				let userId = 1;
				const permissions: string[] = [];
				for (let read = 0; read <= 1; read++) {
					for (let write = 0; write <= 2; write++) {
						for (let eventSubscribe = 0; eventSubscribe <= 1; eventSubscribe++) {
							permissions.push(read.toString() + write.toString() + eventSubscribe.toString());
						}
					}
				}

				// トークン登録しまくる
				return new Promise<void>((resolve, reject) => {
					let permission: string;
					const createToken: (res?: NicoApiResponse<PlayToken>) => void = (res?: NicoApiResponse<PlayToken>) => {
						if (res) {
							expect(res.meta.status).toBe(200);
							expect(res.data.playId).toBe(playId);
							expect(res.data.value).not.toBeUndefined();
							// 大体4時間後くらいの値が入っている。仮の値なのでテストから除外する
							expect(res.data.expire).not.toBeUndefined();
							expect(res.data.url).not.toBeUndefined();
							expect(res.data.permission).toBe(permission);
							expect(res.data.meta.userId).toBe(userId.toString());
							tokens.push(res.data);
							userId++;
						}
						if (permissions.length === 0) {
							resolve(undefined);
							return;
						}
						permission = permissions.pop();
						client.createPlayToken(playId, userId.toString(), permission).then((res) => createToken(res));
					};
					createToken();
				})
					.then(
						() =>
							new Promise<void>((resolve, reject) => {
								let permission: string;
								const createToken: (res?: NicoApiResponse<PlayToken>) => void = (res?: NicoApiResponse<PlayToken>) => {
									if (res) {
										expect(res.meta.status).toBe(200);
										expect(res.data.playId).toBe(playId);
										expect(res.data.value).not.toBeUndefined();
										expect(Date.parse(res.data.expire)).toBeGreaterThan(Date.now() + 3300);
										expect(Date.parse(res.data.expire)).toBeLessThan(Date.now() + 3900);
										expect(res.data.url).not.toBeUndefined();
										expect(res.data.permission).toBe(permission);
										expect(res.data.meta.userId).toBe(userId.toString());
										tokens.push(res.data);
										userId++;
									}
									if (permissions.length === 0) {
										resolve(undefined);
										return;
									}
									permission = permissions.pop();
									client.createPlayToken(playId, userId.toString(), permission, { ttl: 3600 }).then((res) => createToken(res));
								};
								createToken();
							}),
					)
					.catch((err) => {
						console.log("playToken error", err);
						done.fail(err);
					});
			})
			.then(() => {
				// トークン削除しまくる
				return new Promise((resolve, reject) => {
					const deleteToken: (res?: NicoApiResponse<EmptyResponse>) => void = (res?: NicoApiResponse<EmptyResponse>) => {
						if (res) {
							expect(res.meta.status).toBe(200);
						}
						if (tokens.length === 0) {
							resolve();
							return;
						}
						const token = tokens.pop();
						client.deletePlayToken(playId, token.value).then((res) => deleteToken(res));
					};
					deleteToken();
				}).catch((err) => {
					console.log("playToken error", err);
					done.fail(err);
				});
			})
			.then(done)
			.catch((err) => {
				console.log("playToken error", err);
				done.fail(err);
			});
	});

	it("can be successed regardless of the trait (for static dispatching server)", (done) => {
		client
			.createPlay("game1")
			.then((res) => {
				return client.createPlayToken(res.data.id, "1", "120", { trait: "!!invalid trait!!" });
			})
			.then(done)
			.catch((err) => {
				console.log("playToken error", err);
				done.fail(err);
			});
	});

	it("503 returned invalid trait (for dynamic dispatching server)", (done) => {
		client
			.createPlay("game1")
			.then((res) => {
				return dynamicDispatchingClient.createPlayToken(res.data.id, "1", "120", { trait: "!!invalid trait!!" });
			})
			.then((res) => {
				done.fail(new Error("503 is not returned"));
			})
			.catch((err) => {
				expect(err.body.meta.status).toBe(503);
				expect(err.body.meta.errorCode).toBe("SERVICE_UNAVAILABLE");
				done();
			});
	});
});
