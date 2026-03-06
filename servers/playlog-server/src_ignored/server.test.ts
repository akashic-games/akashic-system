import * as lu from "@akashic/log-util";
import * as playlogClient from "@akashic/playlog-client";
import { WebSocketServer } from "@akashic/playlog-server-engine";
import * as dt from "@akashic/server-engine-data-types";
import * as log4js from "log4js";
import { PlayTokenHolder } from "./PlayTokenHolder";
import { ServerEngineFactory } from "./ServerEngineFactory";
import WebSocketAPI from "./WebSocketAPI";

const logger = new lu.LogUtil(log4js.getLogger("out"));

declare const global: any;
class EIOServer {
	constructor(...props: any[]) {
		return;
	}
}

global.WebSocket = WebSocketAPI;

jasmine.DEFAULT_TIMEOUT_INTERVAL = 10 * 1000;

const test = (socketType: string): void => {
	const port = 3000;
	function createClientSession(): playlogClient.Session {
		return new playlogClient.Session("ws://localhost" + ":" + port + "/", { socketType: playlogClient.Socket.Type.WebSocket });
	}

	async function createSessionAndClient(): Promise<{ session: playlogClient.Session; client: playlogClient.Client }> {
		return new Promise<{ session: playlogClient.Session; client: playlogClient.Client }>((resolve, reject) => {
			const session = createClientSession();
			session.open((err) => {
				if (err) {
					return reject(err);
				}
				session.createClient((err, client) => {
					if (err) {
						return reject(err);
					}
					resolve({ session, client: client as playlogClient.Client });
				});
			});
		});
	}

	async function closeSessionAndClient(sc: { session: playlogClient.Session; client: playlogClient.Client }): Promise<{}> {
		return new Promise((resolve, reject) => {
			sc.client.close((err) => {
				sc.session.close((err) => {
					setTimeout(() => {
						resolve();
					}, 100);
				});
			});
		});
	}

	function createPlayTokenHolder(
		id: string,
		sessionId: string,
		playId,
		perm: dt.PlayTokenPermissionLike,
		userId?: string,
		parentId?: string,
	): PlayTokenHolder {
		const token = new dt.PlayToken({
			id,
			playId,
			value: "dummy",
			hash: "dummy",
			expire: new Date(),
			permission: perm,
			meta: userId ? { userId } : {},
		});
		return new PlayTokenHolder(token, sessionId, parentId);
	}
	describe("Server(" + socketType + ")", () => {
		beforeEach((done) => {
			this.handlers = {};
			this.handlers.playlog = {
				prepare: () => Promise.resolve(),
				consumeTick: () => Promise.resolve(),
				consumeEvent: () => Promise.resolve(),
				offConsumeTick: () => Promise.resolve(),
				offConsumeEvent: () => Promise.resolve(),
				acquireWriteLock: () => Promise.resolve(),
				close: () => Promise.resolve(),
			};
			this.handlers.request = {
				refCallCount: 0,
				unrefCallCount: 0,
				ref(): void {
					this.refCallCount++;
				},
				unref(): void {
					this.unrefCallCount++;
				},
			};
			this.handlers.playTokenValidator = {};
			this.factory = new ServerEngineFactory(this.handlers, logger, { mainPlayer: 1, subPlayer: 2 });
			if (socketType === "websocket") {
				this.server = new WebSocketServer(this.factory, logger);
			} else {
				this.server = new EIOServer(this.factory, logger);
			}
			this.server.listen(port, done);
		});

		afterEach((done) => {
			this.server.close(done);
		});

		it("should emit open", (done) => {
			const plcSession = createClientSession();
			const server = this.server;
			let emit = false;
			server.on("error", done.fail);
			server.on("session", (session) => {
				session.on("client", (c) => {
					c.on("open", () => {
						emit = true;
					});
				});
			});
			plcSession.open((err) => {
				expect(err).toBeFalsy();
				plcSession.createClient((err, client) => {
					expect(err).toBeFalsy();
					if (!client) {
						return done.fail();
					}
					client.open("100", (err) => {
						expect(err).toBeFalsy();
						setTimeout(async () => {
							expect(emit).toBe(true);
							expect(this.handlers.request.refCallCount).toBe(1);
							try {
								await closeSessionAndClient({ client, session: plcSession });
								done();
							} catch (error) {
								done.fail(error);
							}
						}, 500);
					});
				});
			});
		});

		it("should emit close", (done) => {
			const plcSession = createClientSession();
			const server = this.server;
			let clientClosed = false;
			let sessionClosed = false;
			server.on("error", done.fail);
			server.on("session", (session) => {
				session.on("client", (c) => {
					c.on("close", () => {
						clientClosed = true;
					});
				});
				session.on("close", () => {
					sessionClosed = true;
				});
			});
			plcSession.open((err) => {
				expect(err).toBeFalsy();
				plcSession.createClient((err, client) => {
					expect(err).toBeFalsy();
					if (!client) {
						return done.fail();
					}
					client.open("100", async (err) => {
						expect(err).toBeFalsy();
						try {
							await closeSessionAndClient({ client, session: plcSession });
							expect(this.handlers.request.refCallCount).toBe(1);
							expect(this.handlers.request.unrefCallCount).toBe(1);
							if (clientClosed && sessionClosed) {
								done();
							} else {
								done.fail();
							}
						} catch (error) {
							done.fail(error);
						}
					});
				});
			});
		});

		it("should success authenticate request", async (done) => {
			const permission = {
				writeTick: true,
				readTick: true,
				subscribeTick: true,
				sendEvent: true,
				subscribeEvent: true,
				maxEventPriority: 2,
			};
			const holder = createPlayTokenHolder("0", "session0", "play0", permission);
			this.handlers.playTokenValidator.validate = () => {
				return Promise.resolve(holder);
			};
			try {
				const sc = await createSessionAndClient();
				await new Promise((resolve, reject) => {
					sc.client.open("100", (err) => {
						expect(err).toBeFalsy();
						sc.client.authenticate("token", (err, perm) => {
							expect(err).toBeFalsy();
							expect(perm).toEqual({
								writeTick: true,
								readTick: true,
								sendEvent: true,
								subscribeEvent: true,
								subscribeTick: true,
								maxEventPriority: 2,
							});
							resolve(sc);
						});
					});
				});
				await closeSessionAndClient(sc);
				done();
			} catch (error) {
				done.fail(error);
			}
		});

		it("should fail authenticate request", async (done) => {
			this.handlers.playTokenValidator.validate = () => {
				return Promise.reject(new Error("fail"));
			};
			try {
				const sc = await createSessionAndClient();
				await new Promise((resolve, reject) => {
					sc.client.open("100", (err) => {
						expect(err).toBeFalsy();
						sc.client.authenticate("token", (err, permission) => {
							expect(err).toBeTruthy();
							resolve(sc);
						});
					});
				});
				await closeSessionAndClient(sc);
				done();
			} catch (error) {
				done.fail(error);
			}
		});

		it("should success GetTickList request", async (done) => {
			const permission = {
				writeTick: true,
				readTick: true,
				subscribeTick: true,
				sendEvent: true,
				subscribeEvent: true,
				maxEventPriority: 2,
			};
			const holder = createPlayTokenHolder("0", "session0", "play0", permission);
			this.handlers.playTokenValidator.validate = () => {
				return Promise.resolve(holder);
			};
			this.handlers.request = {
				ref: () => {
					return;
				},
				unref: () => {
					return;
				},
				getRawTickList: () => {
					return Promise.resolve([
						Buffer.from([0x64]), // fixint 100(0x64)
						Buffer.from([0x65]), // fixint 101(0x65)
						Buffer.from([0x66]), // fixint 102(0x66)
						Buffer.from([0x67]), // fixint 103(0x67)
					]);
				},
			};
			try {
				const sc = await createSessionAndClient();
				await new Promise((resolve, reject) => {
					sc.client.open("100", (err) => {
						expect(err).toBeFalsy();
						sc.client.authenticate("token", (err, permission) => {
							sc.client.getTickList(100, 200, (err, tickList) => {
								expect(err).toBeFalsy();
								expect(tickList).toEqual([100, 103]);
								resolve(sc);
							});
						});
					});
				});
				await closeSessionAndClient(sc);
				done();
			} catch (error) {
				done.fail(error);
			}
		});

		it("should fail GetTickList request", async (done) => {
			const permission = {
				writeTick: true,
				readTick: true,
				subscribeTick: true,
				sendEvent: true,
				subscribeEvent: true,
				maxEventPriority: 2,
			};
			const holder = createPlayTokenHolder("0", "session0", "play0", permission);
			this.handlers.playTokenValidator.validate = () => {
				return Promise.resolve(holder);
			};
			this.handlers.request = {
				ref: () => {
					return;
				},
				unref: () => {
					return;
				},
				getRawTickList: () => {
					return Promise.reject("fail");
				},
			};

			try {
				const sc = await createSessionAndClient();
				await new Promise((resolve, reject) => {
					sc.client.open("100", (err) => {
						expect(err).toBeFalsy();
						sc.client.authenticate("token", (err, permission) => {
							sc.client.getTickList(100, 200, (err, tickList) => {
								expect(err).toBeTruthy();
								resolve(sc);
							});
						});
					});
				});
				await closeSessionAndClient(sc);
				done();
			} catch (error) {
				done.fail(error);
			}
		});

		it("should fail GetTickList request - caused by TokenRevoked error", async (done) => {
			let client;
			const permission = {
				writeTick: true,
				readTick: true,
				subscribeTick: true,
				sendEvent: true,
				subscribeEvent: true,
				maxEventPriority: 2,
			};
			const holder = createPlayTokenHolder("0", "session0", "play0", permission);
			this.handlers.playTokenValidator.validate = () => {
				return Promise.resolve(holder);
			};
			this.handlers.request = {
				ref: () => {
					return;
				},
				unref: () => {
					return;
				},
				getRawTickList: () => {
					return Promise.resolve(Buffer.from([0xc0])); // nullのMessagePackエンコード結果バイト列
				},
			};
			this.server.on("session", (session) => {
				session.on("client", (c) => {
					client = c;
				});
			});
			try {
				const sc = await createSessionAndClient();
				await new Promise((resolve, reject) => {
					sc.client.open("100", (err) => {
						expect(err).toBeFalsy();
						sc.client.authenticate("token", (err, permission) => {
							holder.revoke();
							sc.client.getTickList(100, 200, (err, tickList) => {
								expect(err.name).toBe("TokenRevoked");
								resolve(sc);
							});
						});
					});
				});

				await closeSessionAndClient(sc);
				done();
			} catch (error) {
				done.fail(error);
			}
		});

		it("should success PutStartPoint request", async (done) => {
			const permission = {
				writeTick: true,
				readTick: true,
				subscribeTick: true,
				sendEvent: true,
				subscribeEvent: true,
				maxEventPriority: 2,
			};
			const holder = createPlayTokenHolder("0", "session0", "play0", permission);
			this.handlers.playTokenValidator.validate = () => {
				return Promise.resolve(holder);
			};
			this.handlers.request = {
				ref: () => {
					return;
				},
				unref: () => {
					return;
				},
				putStartPoint: () => {
					return Promise.resolve(null);
				},
			};
			try {
				const sc = await createSessionAndClient();
				await new Promise((resolve, reject) => {
					sc.client.open("100", (err) => {
						expect(err).toBeFalsy();
						sc.client.authenticate("token", (err, permission) => {
							sc.client.putStartPoint({ frame: 200, data: "foo", timestamp: 0 }, (err) => {
								expect(err).toBeFalsy();
								resolve(sc);
							});
						});
					});
				});
				await closeSessionAndClient(sc);
				done();
			} catch (error) {
				done.fail(error);
			}
		});

		it("should fail PutStartPoint request", async (done) => {
			const permission = {
				writeTick: true,
				readTick: true,
				subscribeTick: true,
				sendEvent: true,
				subscribeEvent: true,
				maxEventPriority: 2,
			};
			const holder = createPlayTokenHolder("0", "session0", "play0", permission);
			this.handlers.playTokenValidator.validaten = () => {
				return Promise.resolve(holder);
			};
			this.handlers.request = {
				ref: () => {
					return;
				},
				unref: () => {
					return;
				},
				putStartPoint: () => {
					return Promise.reject("fail");
				},
			};

			try {
				const sc = await createSessionAndClient();
				await new Promise((resolve, reject) => {
					sc.client.open("100", (err) => {
						expect(err).toBeFalsy();
						sc.client.authenticate("token", (err, permission) => {
							sc.client.putStartPoint({ frame: 200, data: "foo", timestamp: 0 }, (err) => {
								expect(err).toBeTruthy();
								resolve(sc);
							});
						});
					});
				});
				await closeSessionAndClient(sc);
				done();
			} catch (error) {
				done.fail(error);
			}
		});

		it("should fail PutStartPoint request - caused by TokenRevoked error", async (done) => {
			let client;
			const permission = {
				writeTick: true,
				readTick: true,
				subscribeTick: true,
				sendEvent: true,
				subscribeEvent: true,
				maxEventPriority: 2,
			};
			const holder = createPlayTokenHolder("0", "session0", "play0", permission);
			this.handlers.playTokenValidator.validate = (session, playId, token) => {
				return Promise.resolve(holder);
			};
			this.handlers.request = {
				ref: () => {
					return;
				},
				unref: () => {
					return;
				},
				putStartPoint: () => {
					return Promise.reject("fail");
				},
			};
			this.server.on("session", (session) => {
				session.on("client", (c) => {
					client = c;
				});
			});

			try {
				const sc = await createSessionAndClient();
				await new Promise((resolve, reject) => {
					sc.client.open("100", (err) => {
						expect(err).toBeFalsy();
						sc.client.authenticate("token", (err, permission) => {
							holder.revoke();
							sc.client.putStartPoint({ frame: 200, data: "foo", timestamp: 0 }, (err) => {
								expect(err.name).toBe("TokenRevoked");
								resolve(sc);
							});
						});
					});
				});
				await closeSessionAndClient(sc);
				done();
			} catch (error) {
				done.fail(error);
			}
		});
	});
};

test("websocket");
