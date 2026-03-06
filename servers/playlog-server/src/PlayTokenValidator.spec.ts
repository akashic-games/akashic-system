import * as plse from "@akashic/playlog-server-engine";
import * as dt from "@akashic/server-engine-data-types";
import { PlayTokenHolder } from "./PlayTokenHolder";
import { PlayTokenValidator } from "./PlayTokenValidator";
const { EventEmitter } = require("events"); // use as fake PlayTokenEventConsumer

class MockSession extends plse.Session {
	constructor(id: string, _socket = {} as any, _factory = {} as any, _logger = {} as any) {
		super(_socket, _factory, _logger, true);
		this.id = id;
	}
}

xdescribe("PlayTokenValidator", () => {
	const conf: any = {
		type: "redis",
		redis: {
			repository: {
				host: "",
				port: 6379,
				auth: "",
			},
			secret: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
		},
	};

	function tokenCacheName(playId: string, hash: string): string {
		return ["playtoken_cache", playId, hash].join("_");
	}

	function parentCacheName(playId: string): string {
		return `akashic:parent_plays:${playId}`;
	}

	const token = dt.PlayToken.fromObject({
		id: "0",
		playId: "100",
		value: "0123456789",
		hash: "9876543210",
		expire: new Date(new Date().getTime() + 3600 * 1000),
		permission: "000",
		meta: { userId: "42" },
	});

	it("should success to validate for a token in token repository", (done) => {
		const session = new MockSession("session0");
		const eventConsumer = new EventEmitter();
		const validator = new PlayTokenValidator(conf, eventConsumer);
		jest.spyOn((validator as any)._redisRepository, "get").mockResolvedValue(JSON.stringify(token));
		jest.spyOn((validator as any)._redisRepository, "del").mockResolvedValue(undefined);
		jest.spyOn((validator as any)._redisRepository, "hgetall").mockResolvedValue({});
		jest.spyOn((validator as any)._tokenGenerator, "generate").mockReturnValue(token.hash);
		validator
			.validate(session, token.playId, token.value)
			.then((holder) => {
				expect(holder.playToken).toEqual(token);
				expect(holder.sessionId).toEqual(session.id);
				expect(holder.parentId).toBeFalsy();
				expect(holder.revoked).toBe(false);
				expect((validator as any)._redisRepository.get).toHaveBeenCalledWith(tokenCacheName(token.playId, token.hash));
				expect((validator as any)._redisRepository.del).toHaveBeenCalledWith(tokenCacheName(token.playId, token.hash));
				expect((validator as any)._redisRepository.hgetall).not.toHaveBeenCalled();
				done();
			})
			.catch(done.fail);
	});

	it("should fail to validate for an expired token", (done) => {
		const session = new MockSession("session0");
		const eventConsumer = new EventEmitter();
		const validator = new PlayTokenValidator(conf, eventConsumer);
		const expiredToken = dt.PlayToken.fromObject({
			id: token.id,
			playId: token.playId,
			value: token.value,
			hash: token.hash,
			expire: new Date(new Date().getTime() - 1),
			permission: token.permission,
			meta: token.meta,
		});
		jest.spyOn((validator as any)._redisRepository, "get").mockResolvedValue(JSON.stringify(expiredToken));
		jest.spyOn((validator as any)._redisRepository, "del").mockResolvedValue(undefined);
		jest.spyOn((validator as any)._redisRepository, "hgetall").mockResolvedValue({});
		jest.spyOn((validator as any)._tokenGenerator, "generate").mockReturnValue(token.hash);
		validator
			.validate(session, token.playId, token.value)
			.then((holder) => {
				done.fail("unexpected validation success");
			})
			.catch((err) => {
				expect((validator as any)._redisRepository.get).toHaveBeenCalledWith(tokenCacheName(token.playId, token.hash));
				expect((validator as any)._redisRepository.del).toHaveBeenCalledWith(tokenCacheName(token.playId, token.hash));
				expect((validator as any)._redisRepository.hgetall).toHaveBeenCalledWith(parentCacheName(token.playId));
				done();
			});
	});

	it("should fail to validate when token and parents are empty", (done) => {
		const session = new MockSession("session0");
		const eventConsumer = new EventEmitter();
		const validator = new PlayTokenValidator(conf, eventConsumer);
		jest.spyOn((validator as any)._redisRepository, "get").mockResolvedValue(null);
		jest.spyOn((validator as any)._redisRepository, "del").mockResolvedValue(undefined);
		jest.spyOn((validator as any)._redisRepository, "hgetall").mockResolvedValue({});
		jest.spyOn((validator as any)._tokenGenerator, "generate").mockReturnValue(token.hash);
		validator
			.validate(session, token.playId, token.value)
			.then((holder) => {
				done.fail("unexpected validation success");
			})
			.catch((err) => {
				expect((validator as any)._redisRepository.get).toHaveBeenCalledWith(tokenCacheName(token.playId, token.hash));
				expect((validator as any)._redisRepository.del).not.toHaveBeenCalled();
				expect((validator as any)._redisRepository.hgetall).toHaveBeenCalledWith(parentCacheName(token.playId));
				done();
			});
	});

	it("should success to validate if parent play on same session has been validated", (done) => {
		const session = new MockSession("session0");
		const eventConsumer = new EventEmitter();
		const validator = new PlayTokenValidator(conf, eventConsumer);
		const childPlayId = "200";
		jest.spyOn((validator as any)._redisRepository, "get").mockImplementation((cacheName) => {
			if (cacheName === tokenCacheName(token.playId, token.hash)) {
				// parent
				return Promise.resolve(JSON.stringify(token));
			}
			// child
			return Promise.resolve(null);
		});
		jest.spyOn((validator as any)._redisRepository, "del").mockResolvedValue(undefined);
		jest.spyOn((validator as any)._redisRepository, "hgetall").mockImplementation((cacheName) => {
			if (cacheName === parentCacheName(token.playId)) {
				// parent
				return Promise.resolve({});
			}
			// child
			const result = {};
			result[token.playId] = "{}";
			return Promise.resolve(result);
		});
		jest.spyOn((validator as any)._tokenGenerator, "generate").mockReturnValue(token.hash);
		validator
			.validate(session, token.playId, token.value)
			.then((holder) => {
				return validator.validate(session, childPlayId, "");
			})
			.then((childHolder) => {
				expect(typeof childHolder.playToken.id).toEqual("string");
				expect(childHolder.playToken.id).not.toEqual(token.id);
				expect(childHolder.playToken.playId).toEqual(childPlayId);
				expect(childHolder.playToken.value).toEqual(token.value);
				expect(childHolder.playToken.hash).toEqual(token.hash);
				expect(childHolder.playToken.expire).toEqual(token.expire);
				expect(childHolder.playToken.permission).toEqual(token.permission);
				expect(childHolder.playToken.meta).toEqual(token.meta);
				expect(childHolder.sessionId).toEqual(session.id);
				expect(childHolder.parentId).toEqual(token.id);
				expect(childHolder.revoked).toBe(false);
				done();
			})
			.catch(done.fail);
	});

	it("should success to validate by parent and reflect allowed permission", (done) => {
		const parentToken = dt.PlayToken.fromObject({
			id: "0",
			playId: "123",
			value: "abcdefghijklmn",
			hash: "opqrstuvwxyz",
			expire: new Date(new Date().getTime() + 3600 * 1000),
			permission: {
				writeTick: false,
				readTick: false,
				subscribeTick: false,
				sendEvent: false,
				subscribeEvent: false,
				maxEventPriority: 0,
			},
			meta: { userId: "42" },
		});
		const session = new MockSession("session0");
		const eventConsumer = new EventEmitter();
		const validator = new PlayTokenValidator(conf, eventConsumer);
		const childPlayId = "200";
		jest.spyOn((validator as any)._redisRepository, "get").mockImplementation((cacheName) => {
			if (cacheName === tokenCacheName(parentToken.playId, parentToken.hash)) {
				// parent
				return Promise.resolve(JSON.stringify(parentToken));
			}
			// child
			return Promise.resolve(null);
		});
		jest.spyOn((validator as any)._redisRepository, "del").mockResolvedValue(undefined);
		jest.spyOn((validator as any)._redisRepository, "hgetall").mockImplementation((cacheName) => {
			if (cacheName === parentCacheName(parentToken.playId)) {
				// parent
				return Promise.resolve({});
			}
			// child
			const result = {};
			result[parentToken.playId] = JSON.stringify({
				allow: {
					writeTick: true,
					readTick: true,
					subscribeTick: true,
					sendEvent: true,
					subscribeEvent: true,
					maxEventPriority: 2,
				},
			});
			return Promise.resolve(result);
		});
		jest.spyOn((validator as any)._tokenGenerator, "generate").mockReturnValue(parentToken.hash);
		validator
			.validate(session, parentToken.playId, parentToken.value)
			.then((holder) => {
				return validator.validate(session, childPlayId, "");
			})
			.then((childHolder) => {
				expect(typeof childHolder.playToken.id).toEqual("string");
				expect(childHolder.playToken.id).not.toEqual(token.id);
				expect(childHolder.playToken.playId).toEqual(childPlayId);
				expect(childHolder.playToken.value).toEqual(parentToken.value);
				expect(childHolder.playToken.hash).toEqual(parentToken.hash);
				expect(childHolder.playToken.expire).toEqual(parentToken.expire);
				expect(childHolder.playToken.permission.writeTick).toEqual(true);
				expect(childHolder.playToken.permission.readTick).toEqual(true);
				expect(childHolder.playToken.permission.subscribeTick).toEqual(true);
				expect(childHolder.playToken.permission.sendEvent).toEqual(true);
				expect(childHolder.playToken.permission.subscribeEvent).toEqual(true);
				expect(childHolder.playToken.permission.maxEventPriority).toEqual(2);
				expect(childHolder.playToken.meta).toEqual(parentToken.meta);
				expect(childHolder.sessionId).toEqual(session.id);
				expect(childHolder.parentId).toEqual(parentToken.id);
				expect(childHolder.revoked).toBe(false);
				done();
			})
			.catch(done.fail);
	});

	it("should success to validate by parent and reflect denied permission", (done) => {
		const parentToken = dt.PlayToken.fromObject({
			id: "0",
			playId: "123",
			value: "abcdefghijklmn",
			hash: "opqrstuvwxyz",
			expire: new Date(new Date().getTime() + 3600 * 1000),
			permission: {
				writeTick: true,
				readTick: true,
				subscribeTick: true,
				sendEvent: true,
				subscribeEvent: true,
				maxEventPriority: 3,
			},
			meta: { userId: "42" },
		});
		const session = new MockSession("session0");
		const eventConsumer = new EventEmitter();
		const validator = new PlayTokenValidator(conf, eventConsumer);
		const childPlayId = "200";
		jest.spyOn((validator as any)._redisRepository, "get").mockImplementation((cacheName) => {
			if (cacheName === tokenCacheName(parentToken.playId, parentToken.hash)) {
				// parent
				return Promise.resolve(JSON.stringify(parentToken));
			}
			// child
			return Promise.resolve(null);
		});
		jest.spyOn((validator as any)._redisRepository, "del").mockResolvedValue(undefined);
		jest.spyOn((validator as any)._redisRepository, "hgetall").mockImplementation((cacheName) => {
			if (cacheName === parentCacheName(parentToken.playId)) {
				// parent
				return Promise.resolve({});
			}
			// child
			const result = {};
			result[parentToken.playId] = JSON.stringify({
				deny: {
					writeTick: true,
					readTick: true,
					subscribeTick: true,
					sendEvent: true,
					subscribeEvent: true,
					maxEventPriority: 1,
				},
			});
			return Promise.resolve(result);
		});
		jest.spyOn((validator as any)._tokenGenerator, "generate").mockReturnValue(parentToken.hash);
		validator
			.validate(session, parentToken.playId, parentToken.value)
			.then((holder) => {
				return validator.validate(session, childPlayId, "");
			})
			.then((childHolder) => {
				expect(typeof childHolder.playToken.id).toEqual("string");
				expect(childHolder.playToken.id).not.toEqual(token.id);
				expect(childHolder.playToken.playId).toEqual(childPlayId);
				expect(childHolder.playToken.value).toEqual(parentToken.value);
				expect(childHolder.playToken.hash).toEqual(parentToken.hash);
				expect(childHolder.playToken.expire).toEqual(parentToken.expire);
				expect(childHolder.playToken.permission.writeTick).toEqual(false);
				expect(childHolder.playToken.permission.readTick).toEqual(false);
				expect(childHolder.playToken.permission.subscribeTick).toEqual(false);
				expect(childHolder.playToken.permission.sendEvent).toEqual(false);
				expect(childHolder.playToken.permission.subscribeEvent).toEqual(false);
				expect(childHolder.playToken.permission.maxEventPriority).toEqual(1);
				expect(childHolder.playToken.meta).toEqual(parentToken.meta);
				expect(childHolder.sessionId).toEqual(session.id);
				expect(childHolder.parentId).toEqual(parentToken.id);
				expect(childHolder.revoked).toBe(false);
				done();
			})
			.catch(done.fail);
	});

	it("should fail to validate if parent play on same session has been revoked", (done) => {
		const session = new MockSession("session0");
		const eventConsumer = new EventEmitter();
		const validator = new PlayTokenValidator(conf, eventConsumer);
		const childPlayId = "200";
		jest.spyOn((validator as any)._redisRepository, "get").mockImplementation((cacheName) => {
			if (cacheName === tokenCacheName(token.playId, token.hash)) {
				// parent
				return Promise.resolve(JSON.stringify(token));
			}
			// child
			return Promise.resolve(null);
		});
		jest.spyOn((validator as any)._redisRepository, "del").mockResolvedValue(undefined);
		jest.spyOn((validator as any)._redisRepository, "hgetall").mockImplementation((cacheName) => {
			if (cacheName === parentCacheName(token.playId)) {
				// parent
				return Promise.resolve({});
			}
			// child
			const result = {};
			result[token.playId] = "{}";
			return Promise.resolve(result);
		});
		jest.spyOn((validator as any)._tokenGenerator, "generate").mockReturnValue(token.hash);
		validator
			.validate(session, token.playId, token.value)
			.then((holder) => {
				eventConsumer.emit("revoke", { id: token.id }, () => {
					return;
				});
				return validator
					.validate(session, childPlayId, "")
					.then((childHolder) => {
						done.fail("unexpected validation success");
					})
					.catch((err) => {
						expect(err.message).toEqual("failed to authenticate.");
						done();
					});
			})
			.catch(done.fail);
	});

	it("should fail to validate if parent play on different session has been validated", (done) => {
		const session = new MockSession("session0");
		const childSession = new MockSession("session1");
		const eventConsumer = new EventEmitter();
		const validator = new PlayTokenValidator(conf, eventConsumer);
		const childPlayId = "200";
		jest.spyOn((validator as any)._redisRepository, "get").mockImplementation((cacheName) => {
			if (cacheName === tokenCacheName(token.playId, token.hash)) {
				// parent
				return Promise.resolve(JSON.stringify(token));
			}
			// child
			return Promise.resolve(null);
		});
		jest.spyOn((validator as any)._redisRepository, "del").mockResolvedValue(undefined);
		jest.spyOn((validator as any)._redisRepository, "hgetall").mockImplementation((cacheName) => {
			if (cacheName === parentCacheName(token.playId)) {
				// parent
				return Promise.resolve({});
			}
			// child
			const result = {};
			result[token.playId] = "{}";
			return Promise.resolve(result);
		});
		jest.spyOn((validator as any)._tokenGenerator, "generate").mockReturnValue(token.hash);
		validator
			.validate(session, token.playId, token.value)
			.then((holder) => {
				return validator
					.validate(childSession, childPlayId, "")
					.then((childHolder) => {
						done.fail("unexpected validation success");
					})
					.catch((err) => {
						expect(err.message).toEqual("failed to authenticate.");
						done();
					});
			})
			.catch(done.fail);
	});

	it("should revoke tokens (parent and child) when revoking event has arrived", (done) => {
		const session = new MockSession("session0");
		const eventConsumer = new EventEmitter();
		const validator = new PlayTokenValidator(conf, eventConsumer);
		const childPlayId = "200";
		jest.spyOn((validator as any)._redisRepository, "get").mockImplementation((cacheName) => {
			if (cacheName === tokenCacheName(token.playId, token.hash)) {
				// parent
				return Promise.resolve(JSON.stringify(token));
			}
			// child
			return Promise.resolve(null);
		});
		jest.spyOn((validator as any)._redisRepository, "del").mockResolvedValue(undefined);
		jest.spyOn((validator as any)._redisRepository, "hgetall").mockImplementation((cacheName) => {
			if (cacheName === parentCacheName(token.playId)) {
				// parent
				return Promise.resolve({});
			}
			// child
			const result = {};
			result[token.playId] = "{}";
			return Promise.resolve(result);
		});
		jest.spyOn((validator as any)._tokenGenerator, "generate").mockReturnValue(token.hash);
		let parentHolder;
		let childHolder;
		validator
			.validate(session, token.playId, token.value)
			.then((holder) => {
				parentHolder = holder;
				return validator.validate(session, childPlayId, "");
			})
			.then((holder) => {
				childHolder = holder;
				expect(parentHolder.revoked).toBe(false);
				let acked = false;
				eventConsumer.emit("revoke", { id: token.id }, () => {
					acked = true;
				});
				expect(acked).toBe(true);
				expect(parentHolder.revoked).toBe(true);
				// 子の revoke は非同期で順次行われるので、少し待つ
				return new Promise((resolve, reject) => {
					setTimeout(resolve, 100);
				});
			})
			.then(() => {
				expect(childHolder.revoked).toBe(true);
				done();
			})
			.catch(done.fail);
	});

	// revoking test
	const ptPermission = {
		writeTick: false,
		readTick: false,
		subscribeTick: false,
		sendEvent: false,
		subscribeEvent: false,
		maxEventPriority: 1,
	};

	function createToken(id: string, playId: string, userId: string): dt.PlayToken {
		return new dt.PlayToken({
			id,
			playId,
			value: [id, playId, userId].join(""),
			hash: [id, playId, userId].join(""),
			expire: new Date(new Date().getTime() + 3600 * 1000),
			permission: ptPermission,
			meta: { userId },
		});
	}
	const tokens = [createToken("100", "0", "0"), createToken("101", "0", "1"), createToken("110", "1", "0"), createToken("110", "1", "1")];
	// redisRepository.get() の spy 用
	function getToken(cacheName: string): Promise<string | null> {
		for (let i = 0; i < tokens.length; ++i) {
			if (cacheName === tokenCacheName(tokens[i].playId, tokens[i].hash)) {
				return Promise.resolve(JSON.stringify(tokens[i]));
			}
		}
		return Promise.resolve(null);
	}

	it("can revoke tokens by play", (done) => {
		const session = new MockSession("session0");
		const eventConsumer = new EventEmitter();
		const validator = new PlayTokenValidator(conf, eventConsumer);
		jest.spyOn((validator as any)._redisRepository, "get").mockImplementation(getToken as (...args: unknown[]) => any);
		jest.spyOn((validator as any)._redisRepository, "del").mockResolvedValue(undefined);
		jest.spyOn((validator as any)._redisRepository, "lrange").mockResolvedValue([]);
		jest.spyOn((validator as any)._tokenGenerator, "generate").mockImplementation((v) => v);
		const doValidate: Promise<PlayTokenHolder>[] = [];
		tokens.forEach((t) => {
			doValidate.push(validator.validate(session, t.playId, t.value));
		});
		Promise.all(doValidate)
			.then((holders) => {
				holders.forEach((holder) => {
					expect(holder.revoked).toBe(false);
				});
				eventConsumer.emit("revoke", { playId: "0" }, () => {
					return;
				});
				expect(holders[0].revoked).toBe(true);
				expect(holders[1].revoked).toBe(true);
				expect(holders[2].revoked).toBe(false);
				expect(holders[3].revoked).toBe(false);
				done();
			})
			.catch(done.fail);
	});

	it("can revoke tokens by user", (done) => {
		const session = new MockSession("session0");
		const eventConsumer = new EventEmitter();
		const validator = new PlayTokenValidator(conf, eventConsumer);
		jest.spyOn((validator as any)._redisRepository, "get").mockImplementation(getToken as (...args: unknown[]) => any);
		jest.spyOn((validator as any)._redisRepository, "del").mockResolvedValue(undefined);
		jest.spyOn((validator as any)._redisRepository, "lrange").mockResolvedValue([]);
		jest.spyOn((validator as any)._tokenGenerator, "generate").mockImplementation((v) => v);
		const doValidate: Promise<PlayTokenHolder>[] = [];
		tokens.forEach((t) => {
			doValidate.push(validator.validate(session, t.playId, t.value));
		});
		Promise.all(doValidate)
			.then((holders) => {
				holders.forEach((holder) => {
					expect(holder.revoked).toBe(false);
				});
				eventConsumer.emit("revoke", { userId: "0" }, () => {
					return;
				});
				expect(holders[0].revoked).toBe(true);
				expect(holders[1].revoked).toBe(false);
				expect(holders[2].revoked).toBe(true);
				expect(holders[3].revoked).toBe(false);
				done();
			})
			.catch(done.fail);
	});

	it("can revoke tokens by play and user", (done) => {
		const session = new MockSession("session0");
		const eventConsumer = new EventEmitter();
		const validator = new PlayTokenValidator(conf, eventConsumer);
		jest.spyOn((validator as any)._redisRepository, "get").mockImplementation(getToken as (...args: unknown[]) => any);
		jest.spyOn((validator as any)._redisRepository, "del").mockResolvedValue(undefined);
		jest.spyOn((validator as any)._redisRepository, "lrange").mockResolvedValue([]);
		jest.spyOn((validator as any)._tokenGenerator, "generate").mockImplementation((v) => v);
		const doValidate: Promise<PlayTokenHolder>[] = [];
		tokens.forEach((t) => {
			doValidate.push(validator.validate(session, t.playId, t.value));
		});
		Promise.all(doValidate)
			.then((holders) => {
				holders.forEach((holder) => {
					expect(holder.revoked).toBe(false);
				});
				eventConsumer.emit("revoke", { playId: "0", userId: "0" }, () => {
					return;
				});
				expect(holders[0].revoked).toBe(true);
				expect(holders[1].revoked).toBe(false);
				expect(holders[2].revoked).toBe(false);
				expect(holders[3].revoked).toBe(false);
				done();
			})
			.catch(done.fail);
	});

	it("can revoke tokens by id and play and user", (done) => {
		const session = new MockSession("session0");
		const eventConsumer = new EventEmitter();
		const validator = new PlayTokenValidator(conf, eventConsumer);
		jest.spyOn((validator as any)._redisRepository, "get").mockImplementation(getToken as (...args: unknown[]) => any);
		jest.spyOn((validator as any)._redisRepository, "del").mockResolvedValue(undefined);
		jest.spyOn((validator as any)._redisRepository, "lrange").mockResolvedValue([]);
		jest.spyOn((validator as any)._tokenGenerator, "generate").mockImplementation((v) => v);
		const doValidate: Promise<PlayTokenHolder>[] = [];
		tokens.forEach((t) => {
			doValidate.push(validator.validate(session, t.playId, t.value));
		});
		Promise.all(doValidate)
			.then((holders) => {
				holders.forEach((holder) => {
					expect(holder.revoked).toBe(false);
				});
				eventConsumer.emit("revoke", { id: "100", playId: "0", userId: "0" }, () => {
					return;
				});
				expect(holders[0].revoked).toBe(true);
				expect(holders[1].revoked).toBe(false);
				expect(holders[2].revoked).toBe(false);
				expect(holders[3].revoked).toBe(false);
				done();
			})
			.catch(done.fail);
	});

	it("should not revoke token which doesn't match revoking condition (id & play & user)", (done) => {
		const session = new MockSession("session0");
		const eventConsumer = new EventEmitter();
		const validator = new PlayTokenValidator(conf, eventConsumer);
		jest.spyOn((validator as any)._redisRepository, "get").mockImplementation(getToken as (...args: unknown[]) => any);
		jest.spyOn((validator as any)._redisRepository, "del").mockResolvedValue(undefined);
		jest.spyOn((validator as any)._redisRepository, "lrange").mockResolvedValue([]);
		jest.spyOn((validator as any)._tokenGenerator, "generate").mockImplementation((v) => v);
		const doValidate: Promise<PlayTokenHolder>[] = [];
		tokens.forEach((t) => {
			doValidate.push(validator.validate(session, t.playId, t.value));
		});
		Promise.all(doValidate)
			.then((holders) => {
				holders.forEach((holder) => {
					expect(holder.revoked).toBe(false);
				});
				eventConsumer.emit("revoke", { id: "100", playId: "0", userId: "1" }, () => {
					return;
				});
				expect(holders[0].revoked).toBe(false);
				expect(holders[1].revoked).toBe(false);
				expect(holders[2].revoked).toBe(false);
				expect(holders[3].revoked).toBe(false);
				done();
			})
			.catch(done.fail);
	});

	it("should not revoke token which doesn't match revoking condition (id & play)", (done) => {
		const session = new MockSession("session0");
		const eventConsumer = new EventEmitter();
		const validator = new PlayTokenValidator(conf, eventConsumer);
		jest.spyOn((validator as any)._redisRepository, "get").mockImplementation(getToken as (...args: unknown[]) => any);
		jest.spyOn((validator as any)._redisRepository, "del").mockResolvedValue(undefined);
		jest.spyOn((validator as any)._redisRepository, "lrange").mockResolvedValue([]);
		jest.spyOn((validator as any)._tokenGenerator, "generate").mockImplementation((v) => v);
		const doValidate: Promise<PlayTokenHolder>[] = [];
		tokens.forEach((t) => {
			doValidate.push(validator.validate(session, t.playId, t.value));
		});
		Promise.all(doValidate)
			.then((holders) => {
				holders.forEach((holder) => {
					expect(holder.revoked).toBe(false);
				});
				eventConsumer.emit("revoke", { id: "100", playId: "1" }, () => {
					return;
				});
				expect(holders[0].revoked).toBe(false);
				expect(holders[1].revoked).toBe(false);
				expect(holders[2].revoked).toBe(false);
				expect(holders[3].revoked).toBe(false);
				done();
			})
			.catch(done.fail);
	});

	it("should not revoke token which doesn't match revoking condition (id & user)", (done) => {
		const session = new MockSession("session0");
		const eventConsumer = new EventEmitter();
		const validator = new PlayTokenValidator(conf, eventConsumer);
		jest.spyOn((validator as any)._redisRepository, "get").mockImplementation(getToken as (...args: unknown[]) => any);
		jest.spyOn((validator as any)._redisRepository, "del").mockResolvedValue(undefined);
		jest.spyOn((validator as any)._redisRepository, "lrange").mockResolvedValue([]);
		jest.spyOn((validator as any)._tokenGenerator, "generate").mockImplementation((v) => v);
		const doValidate: Promise<PlayTokenHolder>[] = [];
		tokens.forEach((t) => {
			doValidate.push(validator.validate(session, t.playId, t.value));
		});
		Promise.all(doValidate)
			.then((holders) => {
				holders.forEach((holder) => {
					expect(holder.revoked).toBe(false);
				});
				eventConsumer.emit("revoke", { id: "100", userId: "1" }, () => {
					return;
				});
				expect(holders[0].revoked).toBe(false);
				expect(holders[1].revoked).toBe(false);
				expect(holders[2].revoked).toBe(false);
				expect(holders[3].revoked).toBe(false);
				done();
			})
			.catch(done.fail);
	});
});
