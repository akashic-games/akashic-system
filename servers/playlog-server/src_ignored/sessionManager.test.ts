import * as lu from "@akashic/log-util";
import * as playlogClient from "@akashic/playlog-client";
import { WebSocketServer } from "@akashic/playlog-server-engine";
import { PlayToken, PlayTokenPermissionLike } from "@akashic/server-engine-data-types";
import { EventEmitter } from "events";
import * as log4js from "log4js";
import { ServerEngineFactory } from "./ServerEngineFactory";
import * as manager from "./SessionManager";
import WebSocketAPI from "./WebSocketAPI";

declare const global: any;
global.WebSocket = WebSocketAPI;
const logger = new lu.LogUtil(log4js.getLogger("out"));

class DummyValidator extends EventEmitter {
	public peekToken(): Promise<PlayToken> {
		return Promise.resolve(
			new PlayToken({
				id: "dummy",
				playId: "42",
				value: "xxx",
				hash: "XXX",
				expire: new Date(),
				permission: {} as PlayTokenPermissionLike,
				meta: {
					userId: "2525",
				},
			}),
		);
	}
}
const dummyValidator = new DummyValidator() as any;

describe("SessionManager", () => {
	it("should success to start", () => {
		const m = new manager.SessionManager(2, 1000, dummyValidator, logger);
		const startids: string[] = [];
		m.on("deny", fail);
		m.on("limit", fail);
		m.on("start", (pid) => {
			startids.push(pid);
		});
		m.reserve("100", "mytoken");
		expect(m.count()).toBe(0);
		expect(m.capacity()).toBe(2);
		expect((m as any)._start("100", "mytoken", "session1")).toBe(true);
		expect(m.count()).toBe(1);
		expect(m.capacity()).toBe(1);
		expect(startids).toEqual(["100"]);
	});
	it("should success to end", () => {
		const m = new manager.SessionManager(2, 1000, dummyValidator, logger);
		const startids: string[] = [];
		const endids: string[] = [];
		m.on("deny", fail);
		m.on("limit", fail);
		m.on("end", (pid) => {
			endids.push(pid);
		});
		m.on("start", (pid) => {
			startids.push(pid);
		});
		m.reserve("101", "mytoken1");
		m.reserve("102", "mytoken2");
		const s1 = { id: "session1" };
		const s2 = { id: "session2" };
		expect((m as any)._start("101", "mytoken1", s1.id)).toBe(true);
		expect((m as any)._start("102", "mytoken2", s2.id)).toBe(true);
		expect(m.count()).toBe(2);
		expect(m.count("101")).toBe(1);
		expect(m.count("102")).toBe(1);
		expect(m.capacity()).toBe(0);
		expect(startids).toEqual(["101", "102"]);
		(m as any)._endBySession(s1);
		expect(m.count()).toBe(1);
		expect(m.count("101")).toBe(0);
		expect(m.count("102")).toBe(1);
		expect(m.capacity()).toBe(1);
		expect(endids).toEqual(["101"]);
		(m as any)._endBySession(s2);
		expect(m.count()).toBe(0);
		expect(m.count("102")).toBe(0);
		expect(m.capacity()).toBe(2);
		expect(endids).toEqual(["101", "102"]);
	});
	it("should fail to start by no capacity", () => {
		const m = new manager.SessionManager(2, 1000, dummyValidator, logger);
		const startids: string[] = [];
		const limitids: string[] = [];
		m.on("deny", fail);
		m.on("limit", (pid) => {
			limitids.push(pid);
		});
		m.on("start", (pid) => {
			startids.push(pid);
		});
		m.reserve("101", "mytoken1");
		m.reserve("102", "mytoken2");
		m.reserve("103", "mytoken3");
		expect((m as any)._start("101", "mytoken1", "session1")).toBe(true);
		expect((m as any)._start("102", "mytoken2", "session2")).toBe(true);
		expect((m as any)._start("103", "mytoken3", "session3")).toBe(false);
		expect(startids).toEqual(["101", "102"]);
		expect(limitids).toEqual(["103"]);
	});
	it("should fail to start by no reservation", () => {
		const m = new manager.SessionManager(2, 1000, dummyValidator, logger);
		const startids: string[] = [];
		const denyids: string[] = [];
		m.on("limit", fail);
		m.on("deny", (pid) => {
			denyids.push(pid);
		});
		m.on("start", (pid) => {
			startids.push(pid);
		});
		m.reserve("101", "mytoken1");
		expect((m as any)._start("101", "mytoken1", "session1")).toBe(true);
		expect((m as any)._start("102", "mytoken2", "session2")).toBe(false);
		expect(denyids).toEqual(["102"]);
		expect(startids).toEqual(["101"]);
	});
	it("should timeout", (done) => {
		const m = new manager.SessionManager(2, 1000, dummyValidator, logger);
		const joincnt = 0;
		const timeoutids: string[] = [];
		const startids: string[] = [];
		const denyids: string[] = [];
		m.on("limit", fail);
		m.on("deny", (pid) => {
			denyids.push(pid);
		});
		m.on("start", (pid) => {
			startids.push(pid);
		});
		m.on("timeout", (pid) => {
			timeoutids.push(pid);
		});
		m.reserve("101", "mytoken1");
		m.reserve("102", "mytoken2");
		expect((m as any)._start("101", "mytoken1", "session1")).toBe(true);
		setTimeout(() => {
			expect((m as any)._start("102", "mytoken2", "session2")).toBe(false);
			expect(timeoutids).toEqual(["102"]);
			expect(startids).toEqual(["101"]);
			expect(denyids).toEqual(["102"]);
			done();
		}, 1500);
	});

	describe("#attachServer", () => {
		const port = 3001;
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
			this.handlers.systemControlAPI = {
				cancelConsumingRevokeEvent: () => {
					return;
				},
			};
			this.factory = new ServerEngineFactory(this.handlers, logger, { mainPlayer: 1, subPlayer: 2 });
			this.server = new WebSocketServer(this.factory, logger, { sessionRefuseClient: true });
			this.server.listen(port, done);
		});

		afterEach((done) => {
			this.server.close(done);
		});

		function createSession(playId: string, token: string): playlogClient.Session {
			return new playlogClient.Session("ws://localhost" + ":" + port + "/", {
				socketType: playlogClient.Socket.Type.WebSocket,
				validationData: { playId, token },
			});
		}

		function closeSession(session: playlogClient.Session): Promise<void> {
			return new Promise((resolve) => {
				session.close(() => {
					resolve();
				});
			});
		}

		it("sould success to start", (done) => {
			const m = new manager.SessionManager(2, 1000, dummyValidator, logger);
			m.attachServer(this.server);
			const startids: string[] = [];
			const limitids: string[] = [];
			m.on("deny", done.fail);
			m.on("limit", (pid) => {
				limitids.push(pid);
			});
			m.on("start", (pid) => {
				startids.push(pid);
			});
			m.reserve("101", "mytoken1");
			m.reserve("102", "mytoken2");
			m.reserve("103", "mytoken3");
			const session101 = createSession("101", "mytoken1");
			const session102 = createSession("102", "mytoken2");
			const session103 = createSession("103", "mytoken3");
			session101.open((err) => {
				expect(err).toBeFalsy();
				session102.open((err) => {
					expect(err).toBeFalsy();
					session103.open(async (err) => {
						expect(err).toBeTruthy();
						expect(startids).toEqual(["101", "102"]);
						expect(limitids).toEqual(["103"]);
						await Promise.all([closeSession(session101), closeSession(session102)]).then(done, done);
					});
				});
			});
		});
		it("should success to end", (done) => {
			const m = new manager.SessionManager(2, 1000, dummyValidator, logger);
			m.attachServer(this.server);
			const startids: string[] = [];
			const endids: string[] = [];
			m.on("deny", done.fail);
			m.on("limit", done.fail);
			m.on("end", (pid) => {
				endids.push(pid);
			});
			m.on("start", (pid) => {
				startids.push(pid);
			});
			m.reserve("101", "mytoken1");
			m.reserve("102", "mytoken2");
			const session101 = createSession("101", "mytoken1");
			const session102 = createSession("102", "mytoken2");
			session101.open((err) => {
				expect(err).toBeFalsy();
				session102.open((err) => {
					expect(err).toBeFalsy();
					expect(m.count()).toBe(2);
					expect(m.count("101")).toBe(1);
					expect(m.count("102")).toBe(1);
					expect(startids).toEqual(["101", "102"]);
					session101.close((err) => {
						expect(err).toBeFalsy();
						setTimeout(() => {
							expect(m.count()).toBe(1);
							expect(m.count("101")).toBe(0);
							expect(m.count("102")).toBe(1);
							expect(m.capacity()).toBe(1);
							expect(endids).toEqual(["101"]);
							session102.close((err) => {
								expect(err).toBeFalsy();
								setTimeout(() => {
									expect(m.count()).toBe(0);
									expect(m.count("102")).toBe(0);
									expect(m.capacity()).toBe(2);
									expect(endids).toEqual(["101", "102"]);
									done();
								}, 100);
							});
						}, 100);
					});
				});
			});
		});
	});
});
