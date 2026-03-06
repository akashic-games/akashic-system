import * as amflow from "@akashic/amflow";
import * as amflowMessage from "@akashic/amflow-message";
import * as amtp from "@akashic/amtplib";
import * as lu from "@akashic/log-util";
import * as playlog from "@akashic/playlog";
import * as playlogClient from "@akashic/playlog-client";
import * as http from "http";
import * as https from "https";
import * as log4js from "log4js";
import * as ServerEngine from "./";

import { WebSocketAPI } from "./WebSocketAPI";

(global as any).WebSocket = WebSocketAPI;

class MockAMFlow implements ServerEngine.AMFlowLike {
	constructor() {}

	public open(playId: string, callback?: (error?: Error) => void): void {
		if (callback) {
			callback();
		}
	}

	public close(callback?: (error?: Error) => void): void {
		if (callback) {
			callback();
		}
	}

	public authenticate(token: string, callback: (error: Error, permission: amflow.Permission) => void): void {}

	public sendTick(tick: playlog.Tick): void {}

	public sendRawTick(tick: Buffer): void {}

	public onTick(handler: (tick: playlog.Tick) => void): void {}

	public offTick(handler: (tick: playlog.Tick) => void): void {}

	public onRawTick(handler: (tick: Buffer) => void): void {}

	public offRawTick(handler: (tick: Buffer) => void): void {}

	public sendEvent(event: playlog.Event): void {}

	public onEvent(handler: (event: playlog.Event) => void): void {}

	public offEvent(handler: (event: playlog.Event) => void): void {}

	public sendRawEvent(event: Buffer): void {}

	public onRawEvent(handler: (event: Buffer) => void): void {}

	public offRawEvent(handler: (event: Buffer) => void): void {}

	public getTickList(begin: number, end: number, callback: (error: Error, tickList: playlog.TickList) => void): void {}

	public getRawTickList(begin: number, end: number, callback: (error: Error, tickList: Buffer[]) => void): void {}

	public putStartPoint(startPoint: amflow.StartPoint, callback: (error: Error) => void): void {}

	public getStartPoint(opts: { frame: number }, callback: (error: Error, startPoint: amflow.StartPoint) => void): void {}

	public putStorageData(key: playlog.StorageKey, value: playlog.StorageValue, options: any, callback: (err: Error) => void): void {}

	public getStorageData(keys: playlog.StorageReadKey[], callback: (error: Error, values: playlog.StorageData[]) => void): void {}
}

class MockFactory implements ServerEngine.Factory {
	public readonly amflow: ServerEngine.AMFlowLike;
	constructor(amflow: ServerEngine.AMFlowLike) {
		this.amflow = amflow;
	}
	public createAMFlow(session: ServerEngine.Session): ServerEngine.AMFlowLike {
		return this.amflow;
	}
}

function createServer(amflow: ServerEngine.AMFlowLike, opts?: ServerEngine.ServerOption): ServerEngine.Server {
	return new ServerEngine.WebSocketServer(new MockFactory(amflow), new lu.LogUtil(log4js.getLogger("out")), opts);
}

function getBoundPort(server: ServerEngine.Server): number {
	const address = ((server as any)._httpServer as http.Server).address();
	if (typeof address === "string") {
		// このケースは UNIX domain socket のときだけなので、起こらないはず
		throw new Error("can't get bound port");
	}
	return address.port;
}

function createClientSession(port: number, opts?: playlogClient.SessionOption): playlogClient.Session {
	const sessionOpts = opts != null ? opts : {};
	sessionOpts.socketType = playlogClient.Socket.Type.WebSocket;
	return new playlogClient.Session("ws://localhost:" + port + "/", sessionOpts);
}

describe("Server Usage", () => {
	it("Server should emit session", (done) => {
		const amflow = new MockAMFlow();
		const server = createServer(amflow).listen(0);
		const port = getBoundPort(server);

		const cs = createClientSession(port);

		server.on("session", () => {
			cs.close(() => {
				server.close(done);
			});
		});
		cs.open((err: Error) => {
			if (err) {
				server.close(() => {
					done.fail(err);
				});
			}
		});
	});

	it("Session should emit channel", (done) => {
		const amflow = new MockAMFlow();
		const server = createServer(amflow).listen(0);
		const port = getBoundPort(server);
		const cs = createClientSession(port);

		server.on("session", (session: ServerEngine.Session) => {
			session.on("channel", (channel: amtp.Channel) => {
				expect(channel.label).toBe("foo");
				setTimeout(() => {
					cs.close(() => {
						server.close(done);
					});
				}, 1000);
			});
		});
		cs.open((err: Error) => {
			if (err) {
				server.close(() => {
					done.fail(err);
				});
				return;
			}
			cs.amtpClient.createChannel({ label: "foo" }, (err, ch) => {
				if (err) {
					cs.close(() => {
						server.close(() => {
							done.fail(err);
						});
					});
				}
			});
		});
	});

	it("Session should emit client", (done) => {
		const amflow = new MockAMFlow();
		const server = createServer(amflow).listen(0);
		const port = getBoundPort(server);
		const cs = createClientSession(port);

		let cl: playlogClient.Client = null;
		server.on("session", (session: ServerEngine.Session) => {
			session.on("client", (c: ServerEngine.Client) => {
				setTimeout(() => {
					cl.close(() => {
						cs.close(() => {
							server.close(done);
						});
					});
				}, 1000);
			});
		});
		cs.open((err: Error) => {
			if (err) {
				server.close(() => {
					done.fail(err);
				});
				return;
			}
			cs.createClient((err, client) => {
				if (err) {
					server.close(() => {
						done.fail(err);
					});
					return;
				}
				cl = client;
				cl.open("100", (err) => {
					if (err) {
						cl.close(() => {
							server.close(() => {
								done.fail(err);
							});
						});
					}
				});
			});
		});
	});

	it("Session should emit refuse", (done) => {
		const amflow = new MockAMFlow();
		const server = createServer(amflow).listen(0);
		const port = getBoundPort(server);
		const cs = createClientSession(port);

		let cl: playlogClient.Client = null;
		server.on("session", (session: ServerEngine.Session) => {
			session.refuseClient = true;
			session.on("client", (c: ServerEngine.Client) => {
				setTimeout(() => {
					cl.close(() => {
						server.close(() => {
							done.fail();
						});
					});
				}, 1000);
			});
			session.on("refuse", () => {
				setTimeout(() => {
					cl.close(() => {
						cs.close(() => {
							server.close(done);
						});
					});
				}, 1000);
			});
		});
		cs.open((err: Error) => {
			if (err) {
				server.close(() => {
					done.fail(err);
				});
				return;
			}
			cs.createClient((err, client) => {
				if (err) {
					server.close(() => {
						done.fail(err);
					});
					return;
				}
				cl = client;
				cl.open("100", (err) => {
					if (err) {
						cl.close(() => {
							cs.close(() => {
								server.close(() => {
									done.fail(err);
								});
							});
						});
					}
				});
			});
		});
	});

	// このテストは、実行ごとの評価値 (Client#sendBuffer) のぶれが大きく、期待値を低めにしないとテストが通らないことがあるため、
	// テスト方法を見直した方がよい
	it("Server should keep data in a buffer", (done) => {
		const permission: amflow.Permission = {
			writeTick: false,
			readTick: false,
			sendEvent: false,
			subscribeEvent: false,
			subscribeTick: true,
			maxEventPriority: 0,
		};
		let cl: playlogClient.Client = null;
		let sc: ServerEngine.Client = null;
		const handlers: Array<(tick: Buffer) => void> = [];
		let timer: NodeJS.Timer = null;
		let cnt = 0;
		let lastRecv: number = null;

		const amflow = new MockAMFlow();
		jest
			.spyOn(amflow, "authenticate")
			.mockImplementation((token: string, callback: (err: Error, permission: amflow.Permission) => void) => {
				callback(null, permission);
			});
		jest.spyOn(amflow, "onRawTick").mockImplementation((callback: (tick: Buffer) => void) => {
			handlers.push(callback);
			timer = setInterval(() => {
				cnt++;
				handlers.forEach((h) => h(amflowMessage.encodeTick([cnt])));
			}, 100);
		});
		const server = createServer(amflow).listen(0);
		const port = getBoundPort(server);
		const cs = createClientSession(port);
		server.on("session", (session: ServerEngine.Session) => {
			session.on("client", (c: ServerEngine.Client) => {
				sc = c;
			});
		});

		cs.open((err: Error) => {
			if (err) {
				server.close(() => {
					done.fail(err);
				});
				return;
			}
			cs.createClient((err, client) => {
				if (err) {
					cs.close(() => {
						server.close(() => {
							done.fail(err);
						});
					});
					return;
				}
				cl = client;
				cl.open("100", (err) => {
					if (err) {
						cl.close(() => {
							cs.close(() => {
								server.close(() => {
									done.fail(err);
								});
							});
						});
						return;
					}
					cl.authenticate("foo", () => {
						cl.onTick((t) => {
							lastRecv = t[0];
							if (lastRecv === 10) {
								(cs as any)._socket.close(); // 強制的に切断する
								setTimeout(() => {
									expect((sc as any).sendBuffer.length).toBeGreaterThan(25);
									clearInterval(timer);
									server.close(done);
								}, 3000);
							}
						});
					});
				});
			});
		});
	});

	it("Server should keep data in a buffer and send", (done) => {
		const permission: amflow.Permission = {
			writeTick: false,
			readTick: false,
			sendEvent: false,
			subscribeEvent: false,
			subscribeTick: true,
			maxEventPriority: 0,
		};
		let cl: playlogClient.Client = null;
		let sc: ServerEngine.Client = null;
		const handlers: Array<(tick: Buffer) => void> = [];
		let timer: NodeJS.Timer = null;
		let cnt = 0;
		let lastRecv: number = null;

		const amflow = new MockAMFlow();
		jest
			.spyOn(amflow, "authenticate")
			.mockImplementation((token: string, callback: (err: Error, permission: amflow.Permission) => void) => {
				callback(null, permission);
			});
		jest.spyOn(amflow, "onRawTick").mockImplementation((callback: (tick: Buffer) => void) => {
			handlers.push(callback);
			timer = setInterval(() => {
				cnt++;
				handlers.forEach((h) => h(amflowMessage.encodeTick([cnt])));
				if (cnt === 10) {
					sc.startBuffering();
				}
				if (cnt === 20) {
					expect(lastRecv).toBe(10);
					sc.stopBufferingAndFlush();
				}
				if (cnt === 30) {
					clearInterval(timer);
				}
			}, 10);
		});
		const server = createServer(amflow).listen(0);
		const port = getBoundPort(server);
		const cs = createClientSession(port);
		server.on("session", (session: ServerEngine.Session) => {
			session.on("client", (c: ServerEngine.Client) => {
				sc = c;
			});
		});

		cs.open((err: Error) => {
			if (err) {
				server.close(() => {
					done.fail(err);
				});
				return;
			}
			cs.createClient((err, client) => {
				if (err) {
					cs.close(() => {
						server.close(() => {
							done.fail(err);
						});
					});
					return;
				}
				cl = client;
				cl.open("100", (err) => {
					if (err) {
						done.fail(err);
					}
					cl.authenticate("foo", () => {
						cl.onTick((t) => {
							lastRecv = t[0];
							if (lastRecv === 30) {
								cl.close(() => {
									cs.close(() => {
										server.close(done);
									});
								});
							}
						});
					});
				});
			});
		});
	});

	it("Client should open", (done) => {
		let cl: playlogClient.Client = null;

		const amflow = new MockAMFlow();
		jest.spyOn(amflow, "open").mockImplementation((playId: string, callback: (err: Error) => void) => {
			expect(playId).toBe("100");
			callback(null);
			setTimeout(() => {
				cl.close(() => {
					cs.close(() => {
						server.close(done);
					});
				});
			}, 1000);
		});
		const server = createServer(amflow).listen(0);
		const port = getBoundPort(server);
		const cs = createClientSession(port);

		cs.open((err: Error) => {
			if (err) {
				server.close(() => {
					done.fail(err);
				});
				return;
			}
			cs.createClient((err, client) => {
				if (err) {
					cs.close(() => {
						server.close(() => {
							done.fail(err);
						});
					});
					return;
				}
				cl = client;
				cl.open("100", (err) => {
					if (err) {
						cl.close(() => {
							cs.close(() => {
								server.close(() => {
									done.fail(err);
								});
							});
						});
					}
				});
			});
		});
	});

	it("Client should authenticate", (done) => {
		const permission: amflow.Permission = {
			writeTick: false,
			readTick: false,
			sendEvent: false,
			subscribeEvent: false,
			subscribeTick: false,
			maxEventPriority: 0,
		};
		let cl: playlogClient.Client = null;

		const amflow = new MockAMFlow();
		jest
			.spyOn(amflow, "authenticate")
			.mockImplementation((token: string, callback: (err: Error, permission: amflow.Permission) => void) => {
				expect(token).toBe("foo");
				callback(null, permission);
			});
		const server = createServer(amflow).listen(0);
		const port = getBoundPort(server);
		const cs = createClientSession(port);

		cs.open((err: Error) => {
			if (err) {
				server.close(() => {
					done.fail(err);
				});
				return;
			}
			cs.createClient((err, client) => {
				if (err) {
					cs.close(() => {
						server.close(() => {
							done.fail(err);
						});
					});
					return;
				}
				cl = client;
				cl.open("100", (err) => {
					if (err) {
						cl.close(() => {
							cs.close(() => {
								server.close(() => {
									done.fail(err);
								});
							});
						});
						return;
					}
					cl.authenticate("foo", (err, p) => {
						expect(p).toEqual(permission);
						setTimeout(() => {
							cl.close(() => {
								cs.close(() => {
									server.close(done);
								});
							});
						}, 1000);
					});
				});
			});
		});
	});

	it("Client should send tick", (done) => {
		const permission: amflow.Permission = {
			writeTick: true,
			readTick: false,
			sendEvent: false,
			subscribeEvent: false,
			subscribeTick: false,
			maxEventPriority: 0,
		};
		let sendCount: number = 0;
		let cl: playlogClient.Client = null;

		const amflow = new MockAMFlow();
		jest
			.spyOn(amflow, "authenticate")
			.mockImplementation((token: string, callback: (err: Error, permission: amflow.Permission) => void) => {
				callback(null, permission);
			});
		jest.spyOn(amflow, "sendRawTick").mockImplementation((tick: Buffer) => {
			expect(tick[0]).toBe(sendCount++);
			if (sendCount === 10) {
				setTimeout(() => {
					cl.close(() => {
						cs.close(() => {
							server.close(done);
						});
					});
				}, 1000);
			}
		});
		const server = createServer(amflow).listen(0);
		const port = getBoundPort(server);
		const cs = createClientSession(port);

		cs.open((err: Error) => {
			if (err) {
				server.close(() => {
					done.fail(err);
				});
				return;
			}
			cs.createClient((err, client) => {
				if (err) {
					cs.close(() => {
						server.close(() => {
							done.fail(err);
						});
					});
					return;
				}
				cl = client;
				cl.open("100", (err) => {
					cl.authenticate("foo", (err, p) => {
						expect(p).toEqual(permission);
						for (let i = 0; i < 10; i++) {
							cl.sendTick([i]);
						}
					});
				});
			});
		});
	});

	it("Client should send event", (done) => {
		const permission: amflow.Permission = {
			writeTick: false,
			readTick: false,
			sendEvent: true,
			subscribeEvent: false,
			subscribeTick: false,
			maxEventPriority: 0,
		};
		let cl: playlogClient.Client = null;
		let sendCount: number = 0;

		const amflow = new MockAMFlow();
		jest
			.spyOn(amflow, "authenticate")
			.mockImplementation((token: string, callback: (err: Error, permission: amflow.Permission) => void) => {
				callback(null, permission);
			});
		jest.spyOn(amflow, "sendRawEvent").mockImplementation((buf: Buffer) => {
			const event = amflowMessage.decodeEvent(buf);
			expect(event[3]).toBe(sendCount++);
			if (sendCount === 10) {
				setTimeout(() => {
					cl.close(() => {
						cs.close(() => {
							server.close(done);
						});
					});
				}, 1000);
			}
		});
		const server = createServer(amflow).listen(0);
		const port = getBoundPort(server);
		const cs = createClientSession(port);

		cs.open((err: Error) => {
			if (err) {
				server.close(() => {
					done.fail(err);
				});
				return;
			}
			cs.createClient((err, client) => {
				if (err) {
					cs.close(() => {
						server.close(() => {
							done.fail(err);
						});
					});
					return;
				}
				cl = client;
				cl.open("100", (err) => {
					cl.authenticate("foo", (err, p) => {
						expect(p).toEqual(permission);
						for (let i = 0; i < 10; i++) {
							cl.sendEvent([0x20, 2, "tom", i]);
						}
					});
				});
			});
		});
	});

	it("Client should subscribe tick", (done) => {
		const permission: amflow.Permission = {
			writeTick: false,
			readTick: false,
			sendEvent: false,
			subscribeEvent: false,
			subscribeTick: true,
			maxEventPriority: 0,
		};
		let cl: playlogClient.Client = null;
		let handler: (tick: Buffer) => void = null;
		let recvCount = 0;

		const amflow = new MockAMFlow();
		jest
			.spyOn(amflow, "authenticate")
			.mockImplementation((token: string, callback: (err: Error, permission: amflow.Permission) => void) => {
				callback(null, permission);
			});
		jest.spyOn(amflow, "onRawTick").mockImplementation((callback: (tick: Buffer) => void) => {
			handler = callback;
			setTimeout(() => {
				for (let i = 0; i < 10; i++) {
					handler(amflowMessage.encodeTick([i]));
				}
			}, 1000);
		});
		const server = createServer(amflow).listen(0);
		const port = getBoundPort(server);
		const cs = createClientSession(port);

		cs.open((err: Error) => {
			if (err) {
				server.close(() => {
					done.fail(err);
				});
				return;
			}
			cs.createClient((err, client) => {
				if (err) {
					cs.close(() => {
						server.close(() => {
							done.fail(err);
						});
					});
					return;
				}
				cl = client;
				cl.open("100", (err) => {
					cl.authenticate("foo", (err, p) => {
						expect(p).toEqual(permission);
						cl.onTick((tick: playlog.Tick) => {
							expect(tick[0]).toBe(recvCount++);
							if (recvCount === 10) {
								setTimeout(() => {
									cl.close(() => {
										cs.close(() => {
											server.close(done);
										});
									});
								}, 1000);
							}
						});
					});
				});
			});
		});
	});

	it("Client should subscribe tick by two client", (done) => {
		const permission: amflow.Permission = {
			writeTick: false,
			readTick: false,
			sendEvent: false,
			subscribeEvent: false,
			subscribeTick: true,
			maxEventPriority: 0,
		};
		let cl1: playlogClient.Client = null;
		let cl2: playlogClient.Client = null;
		const handlers: Array<(tick: Buffer) => void> = [];
		let recvCount1 = 0;
		let recvCount2 = 0;

		const amflow = new MockAMFlow();
		jest
			.spyOn(amflow, "authenticate")
			.mockImplementation((token: string, callback: (err: Error, permission: amflow.Permission) => void) => {
				callback(null, permission);
			});
		jest.spyOn(amflow, "onRawTick").mockImplementation((callback: (tick: Buffer) => void) => {
			handlers.push(callback);
		});
		const server = createServer(amflow).listen(0);
		const port = getBoundPort(server);
		const cs1 = createClientSession(port);
		const cs2 = createClientSession(port);

		new Promise<void>((resolve, reject) => {
			cs1.open((err: Error) => {
				cs1.createClient((err, client) => {
					cl1 = client;
					cl1.open("100", (err: Error) => {
						cl1.authenticate("foo", (err, p) => {
							cl1.onTick((tick: playlog.Tick) => {
								expect(tick[0]).toBe(recvCount1++);
							});
							resolve();
						});
					});
				});
			});
		})
			.then(() => {
				return new Promise<void>((resolve, reject) => {
					cs2.open((err: Error) => {
						cs2.createClient((err, client) => {
							cl2 = client;
							cl2.open("100", (err: Error) => {
								cl2.authenticate("foo", (err, p) => {
									cl2.onTick((tick: playlog.Tick) => {
										expect(tick[0]).toBe(recvCount2++);
									});
									resolve();
								});
							});
						});
					});
				});
			})
			.then(() => {
				return new Promise<void>((resolve, reject) => {
					setTimeout(() => {
						for (let i = 0; i < 10; i++) {
							handlers.forEach((h) => {
								h(amflowMessage.encodeTick([i]));
							});
						}
						resolve();
					}, 500);
				});
			})
			.then(() => {
				setTimeout(() => {
					expect(recvCount1).toBe(10);
					expect(recvCount2).toBe(10);
					cl1.close(() => {
						cl2.close(() => {
							cs1.close(() => {
								cs2.close(() => {
									server.close(done);
								});
							});
						});
					});
				}, 500);
			});
	});

	it("Client should subscribe event", (done) => {
		const permission: amflow.Permission = {
			writeTick: false,
			readTick: false,
			sendEvent: false,
			subscribeEvent: true,
			subscribeTick: false,
			maxEventPriority: 0,
		};
		let cl: playlogClient.Client = null;
		let handler: (event: Buffer) => void = null;
		let recvCount = 0;

		const amflow = new MockAMFlow();
		jest
			.spyOn(amflow, "authenticate")
			.mockImplementation((token: string, callback: (err: Error, permission: amflow.Permission) => void) => {
				callback(null, permission);
			});
		jest.spyOn(amflow, "onRawEvent").mockImplementation((callback: (event: Buffer) => void) => {
			handler = callback;
			setTimeout(() => {
				for (let i = 0; i < 10; i++) {
					handler(amflowMessage.encodeEvent([0x20, 2, "tom", i]));
				}
			}, 1000);
		});
		const server = createServer(amflow).listen(0);
		const port = getBoundPort(server);
		const cs = createClientSession(port);

		cs.open((error) => {
			cs.createClient((error, client) => {
				cl = client;
				cl.open("100", (err: Error) => {
					cl.authenticate("foo", (err, p) => {
						expect(p).toEqual(permission);
						cl.onEvent((event: playlog.Event) => {
							expect(event[3]).toBe(recvCount++);
							if (recvCount === 10) {
								setTimeout(() => {
									client.close(() => {
										cs.close(() => {
											server.close(done);
										});
									});
								}, 1000);
							}
						});
					});
				});
			});
		});
	});

	it("Client should get tick list", (done) => {
		const permission: amflow.Permission = {
			writeTick: false,
			readTick: true,
			sendEvent: false,
			subscribeEvent: false,
			subscribeTick: false,
			maxEventPriority: 0,
		};

		const amflow = new MockAMFlow();
		jest
			.spyOn(amflow, "authenticate")
			.mockImplementation((token: string, callback: (err: Error, permission: amflow.Permission) => void) => {
				callback(null, permission);
			});
		jest
			.spyOn(amflow, "getRawTickList")
			.mockImplementation((from: number, to: number, callback: (err: Error, tickList: Buffer[]) => void) => {
				const ticks = [];
				for (let i = 64; i < 80; ++i) {
					const encoded = Buffer.from([i]); // i は positive fixint (0x00-0x7f) なのでそのままBufferにするだけ
					ticks.push(encoded);
				}
				ticks.push(
					Buffer.from([
						// [80, [[0x20, 2, "c", {}]]] のMessagePackエンコード列
						0x92, // Array(2)
						0x50, // fixint 80(0x50)
						0x91, // Array(1)
						0x94, // Array(4)
						0x20, // fixint 32(0x20) === playlog.EventCode.Message
						0x02, // fixint 2(0x02) / priority
						0xa1, // fixstr (length 1)
						0x63, // char c
						0x80, // fixmap (size 0)
					]),
				);
				callback(null, ticks);
			});
		const server = createServer(amflow).listen(0);
		const port = getBoundPort(server);
		const cs = createClientSession(port);

		cs.open(() => {
			cs.createClient((err, client) => {
				client.open("100", (err: Error) => {
					client.authenticate("foo", (err, p) => {
						client.getTickList(64, 100, (err, tickList) => {
							expect(err).toBeFalsy();
							expect(tickList).toEqual([64, 80, [[80, [[0x20, 2, "c", {}]]]]]);
							setTimeout(() => {
								client.close(() => {
									cs.close(() => {
										server.close(done);
									});
								});
							}, 1000);
						});
					});
				});
			});
		});
	});

	it("Client should get empty tick list", (done) => {
		const permission: amflow.Permission = {
			writeTick: false,
			readTick: true,
			sendEvent: false,
			subscribeEvent: false,
			subscribeTick: false,
			maxEventPriority: 0,
		};

		const amflow = new MockAMFlow();
		jest
			.spyOn(amflow, "authenticate")
			.mockImplementation((token: string, callback: (err: Error, permission: amflow.Permission) => void) => {
				callback(null, permission);
			});
		jest
			.spyOn(amflow, "getRawTickList")
			.mockImplementation((from: number, to: number, callback: (err: Error, tickList: Buffer[]) => void) => {
				callback(null, []);
			});
		const server = createServer(amflow).listen(0);
		const port = getBoundPort(server);
		const cs = createClientSession(port);

		cs.open(() => {
			cs.createClient((err, client) => {
				client.open("100", (err: Error) => {
					client.authenticate("foo", (err, p) => {
						client.getTickList(64, 100, (err, tickList) => {
							expect(err).toBeFalsy();
							expect(tickList).toBe(null);
							setTimeout(() => {
								client.close(() => {
									cs.close(() => {
										server.close(done);
									});
								});
							}, 1000);
						});
					});
				});
			});
		});
	});

	it("Client should fail to get tick list", (done) => {
		const permission: amflow.Permission = {
			writeTick: false,
			readTick: true,
			sendEvent: false,
			subscribeEvent: false,
			subscribeTick: false,
			maxEventPriority: 0,
		};

		const amflow = new MockAMFlow();
		jest
			.spyOn(amflow, "authenticate")
			.mockImplementation((token: string, callback: (err: Error, permission: amflow.Permission) => void) => {
				callback(null, permission);
			});
		jest
			.spyOn(amflow, "getRawTickList")
			.mockImplementation((from: number, to: number, callback: (err: Error, tickList?: Buffer[]) => void) => {
				callback(new Error("fail"));
			});
		const server = createServer(amflow).listen(0);
		const port = getBoundPort(server);
		const cs = createClientSession(port);

		cs.open(() => {
			cs.createClient((err, client) => {
				client.open("100", (err: Error) => {
					client.authenticate("foo", (err, p) => {
						client.getTickList(100, 300, (err, tickList) => {
							expect(err).toBeTruthy();
							setTimeout(() => {
								client.close(() => {
									cs.close(() => {
										server.close(done);
									});
								});
							}, 1000);
						});
					});
				});
			});
		});
	});

	it("Client should not receive getTickList result after closing", (done) => {
		const permission: amflow.Permission = {
			writeTick: false,
			readTick: true,
			sendEvent: false,
			subscribeEvent: false,
			subscribeTick: false,
			maxEventPriority: 0,
		};
		let clientClosed = false;

		const amflow = new MockAMFlow();
		jest
			.spyOn(amflow, "authenticate")
			.mockImplementation((token: string, callback: (err: Error, permission: amflow.Permission) => void) => {
				callback(null, permission);
			});
		jest
			.spyOn(amflow, "getRawTickList")
			.mockImplementation((from: number, to: number, callback: (err: Error, tickList: Buffer[]) => void) => {
				setTimeout(() => {
					callback(null, []);
					setTimeout(() => {
						expect(clientClosed).toBe(true);
						cs.close(() => {
							server.close(done);
						});
					}, 1000);
				}, 2000);
			});
		const server = createServer(amflow).listen(0);
		const port = getBoundPort(server);
		const cs = createClientSession(port);

		cs.open(() => {
			cs.createClient((err, client) => {
				client.open("100", (err: Error) => {
					client.authenticate("foo", (err, p) => {
						setTimeout(() => {
							client.close(() => {
								clientClosed = true;
							});
						}, 1000);
						client.getTickList(64, 100, (err, tickList) => {
							client.close(() => {
								cs.close(() => {
									server.close(() => {
										done.fail();
									});
								});
							});
						});
					});
				});
			});
		});
	});

	it("Client should put start point", (done) => {
		const permission: amflow.Permission = {
			writeTick: true,
			readTick: true,
			sendEvent: false,
			subscribeEvent: false,
			subscribeTick: false,
			maxEventPriority: 0,
		};

		const amflow = new MockAMFlow();
		jest
			.spyOn(amflow, "authenticate")
			.mockImplementation((token: string, callback: (err: Error, permission: amflow.Permission) => void) => {
				callback(null, permission);
			});
		jest.spyOn(amflow, "putStartPoint").mockImplementation((startPoint: { frame: number; data: any }, callback: (err: Error) => void) => {
			expect(startPoint.data).toBe("bar");
			callback(null);
		});
		const server = createServer(amflow).listen(0);
		const port = getBoundPort(server);

		const cs = createClientSession(port);
		cs.open(() => {
			cs.createClient((err, client) => {
				client.open("100", (err: Error) => {
					client.authenticate("foo", (err, p) => {
						client.putStartPoint({ frame: 100, data: "bar", timestamp: 0 }, (err) => {
							expect(err).toBeFalsy();
							setTimeout(() => {
								client.close(() => {
									cs.close(() => {
										server.close(done);
									});
								});
							}, 1000);
						});
					});
				});
			});
		});
	});

	it("Client should not receive putStartPoint result after closing", (done) => {
		const permission: amflow.Permission = {
			writeTick: true,
			readTick: true,
			sendEvent: false,
			subscribeEvent: false,
			subscribeTick: false,
			maxEventPriority: 0,
		};
		let clientClosed = false;

		const amflow = new MockAMFlow();
		jest
			.spyOn(amflow, "authenticate")
			.mockImplementation((token: string, callback: (err: Error, permission: amflow.Permission) => void) => {
				callback(null, permission);
			});
		jest.spyOn(amflow, "putStartPoint").mockImplementation((startPoint: { frame: number; data: any }, callback: (err: Error) => void) => {
			expect(startPoint.data).toBe("bar");
			setTimeout(() => {
				callback(null);
				setTimeout(() => {
					expect(clientClosed).toBe(true);
					cs.close(() => {
						server.close(done);
					});
				}, 1000);
			}, 2000);
		});
		const server = createServer(amflow).listen(0);
		const port = getBoundPort(server);
		const cs = createClientSession(port);

		cs.open(() => {
			cs.createClient((err, client) => {
				client.open("100", (err: Error) => {
					client.authenticate("foo", (err, p) => {
						setTimeout(() => {
							client.close(() => {
								cs.close(() => {
									clientClosed = true;
								});
							});
						}, 1000);
						client.putStartPoint({ frame: 100, data: "bar", timestamp: 0 }, (err) => {
							client.close(() => {
								cs.close(() => {
									server.close(() => {
										done.fail();
									});
								});
							});
						});
					});
				});
			});
		});
	});

	it("Client should fail to put start point", (done) => {
		const permission: amflow.Permission = {
			writeTick: true,
			readTick: true,
			sendEvent: false,
			subscribeEvent: false,
			subscribeTick: false,
			maxEventPriority: 0,
		};

		const amflow = new MockAMFlow();
		jest
			.spyOn(amflow, "authenticate")
			.mockImplementation((token: string, callback: (err: Error, permission: amflow.Permission) => void) => {
				callback(null, permission);
			});
		jest.spyOn(amflow, "putStartPoint").mockImplementation((startPoint: { frame: number; data: any }, callback: (err: Error) => void) => {
			expect(startPoint.data).toBe("bar");
			callback(new Error("fail"));
		});
		const server = createServer(amflow).listen(0);
		const port = getBoundPort(server);
		const cs = createClientSession(port);

		cs.open(() => {
			cs.createClient((err, client) => {
				client.open("100", (err: Error) => {
					client.authenticate("foo", (err, p) => {
						client.putStartPoint({ frame: 100, data: "bar", timestamp: 0 }, (err) => {
							expect(err).toBeTruthy();
							setTimeout(() => {
								client.close(() => {
									cs.close(() => {
										server.close(done);
									});
								});
							}, 1000);
						});
					});
				});
			});
		});
	});

	it("Client should get start point", (done) => {
		const permission: amflow.Permission = {
			writeTick: true,
			readTick: true,
			sendEvent: false,
			subscribeEvent: false,
			subscribeTick: false,
			maxEventPriority: 0,
		};

		const amflow = new MockAMFlow();
		jest
			.spyOn(amflow, "authenticate")
			.mockImplementation((token: string, callback: (err: Error, permission: amflow.Permission) => void) => {
				callback(null, permission);
			});
		jest
			.spyOn(amflow, "getStartPoint")
			.mockImplementation((opt: { frame?: number }, callback: (err: Error, startPoint: amflow.StartPoint) => void) => {
				expect(opt.frame).toBe(100);
				callback(null, { frame: 90, data: "baz", timestamp: 0 });
			});
		const server = createServer(amflow).listen(0);
		const port = getBoundPort(server);
		const cs = createClientSession(port);

		cs.open(() => {
			cs.createClient((err, client) => {
				client.open("100", (err: Error) => {
					client.authenticate("foo", (err, p) => {
						client.getStartPoint({ frame: 100 }, (err, startPoint) => {
							expect(err).toBeFalsy();
							expect(startPoint.frame).toBe(90);
							expect(startPoint.data).toBe("baz");
							setTimeout(() => {
								client.close(() => {
									cs.close(() => {
										server.close(done);
									});
								});
							}, 1000);
						});
					});
				});
			});
		});
	});

	it("Client should not receive getStartPoint result after closing", (done) => {
		const permission: amflow.Permission = {
			writeTick: true,
			readTick: true,
			sendEvent: false,
			subscribeEvent: false,
			subscribeTick: false,
			maxEventPriority: 0,
		};
		let clientClosed = false;

		const amflow = new MockAMFlow();
		jest
			.spyOn(amflow, "authenticate")
			.mockImplementation((token: string, callback: (err: Error, permission: amflow.Permission) => void) => {
				callback(null, permission);
			});
		jest
			.spyOn(amflow, "getStartPoint")
			.mockImplementation((opt: { frame?: number }, callback: (err: Error, startPoint: amflow.StartPoint) => void) => {
				setTimeout(() => {
					callback(null, { frame: 90, data: "baz", timestamp: 0 });
					setTimeout(() => {
						expect(clientClosed).toBe(true);
						server.close(done);
					}, 1000);
				}, 2000);
			});
		const server = createServer(amflow).listen(0);
		const port = getBoundPort(server);
		const cs = createClientSession(port);

		cs.open(() => {
			cs.createClient((err, client) => {
				client.open("100", (err: Error) => {
					client.authenticate("foo", (err, p) => {
						setTimeout(() => {
							client.close(() => {
								cs.close(() => {
									clientClosed = true;
								});
							});
						}, 1000);
						client.getStartPoint({ frame: 100 }, (err, startPoint) => {
							client.close(() => {
								cs.close(() => {
									server.close(() => {
										done.fail();
									});
								});
							});
						});
					});
				});
			});
		});
	});

	it("Client should fail to get start point", (done) => {
		const permission: amflow.Permission = {
			writeTick: true,
			readTick: true,
			sendEvent: false,
			subscribeEvent: false,
			subscribeTick: false,
			maxEventPriority: 0,
		};

		const amflow = new MockAMFlow();
		jest
			.spyOn(amflow, "authenticate")
			.mockImplementation((token: string, callback: (err: Error, permission: amflow.Permission) => void) => {
				callback(null, permission);
			});
		jest
			.spyOn(amflow, "getStartPoint")
			.mockImplementation((opt: { frame?: number }, callback: (err: Error, startPoint?: amflow.StartPoint) => void) => {
				expect(opt.frame).toBe(100);
				callback(new Error("fail"));
			});
		const server = createServer(amflow).listen(0);
		const port = getBoundPort(server);
		const cs = createClientSession(port);

		cs.open(() => {
			cs.createClient((err, client) => {
				client.open("100", (err: Error) => {
					client.authenticate("foo", (err, p) => {
						client.getStartPoint({ frame: 100 }, (err, startPoint) => {
							expect(err).toBeTruthy();
							setTimeout(() => {
								client.close(() => {
									cs.close(() => {
										server.close(done);
									});
								});
							}, 1000);
						});
					});
				});
			});
		});
	});

	it("Client should get storage data", (done) => {
		const readKeys: playlog.StorageKey[] = [
			{ region: 1, regionKey: "foo", gameId: "10", userId: "20" },
			{ region: 1, regionKey: "bar", gameId: "20", userId: "30" },
		];
		const permission: amflow.Permission = {
			writeTick: true,
			readTick: true,
			sendEvent: false,
			subscribeEvent: false,
			subscribeTick: false,
			maxEventPriority: 0,
		};

		const amflow = new MockAMFlow();
		jest
			.spyOn(amflow, "authenticate")
			.mockImplementation((token: string, callback: (err: Error, permission: amflow.Permission) => void) => {
				callback(null, permission);
			});
		jest
			.spyOn(amflow, "getStorageData")
			.mockImplementation((keys: playlog.StorageReadKey[], callback: (err: Error, values: playlog.StorageData[]) => void) => {
				expect(keys).toEqual(readKeys);
				callback(null, [
					{ readKey: readKeys[0], values: [] },
					{ readKey: readKeys[1], values: [] },
				]);
			});
		const server = createServer(amflow).listen(0);
		const port = getBoundPort(server);
		const cs = createClientSession(port);

		cs.open(() => {
			cs.createClient((err, client) => {
				client.open("100", (err: Error) => {
					client.authenticate("foo", (err, p) => {
						client.getStorageData(readKeys, (err, values) => {
							expect(err).toBeFalsy();
							expect(values.length).toBe(2);
							setTimeout(() => {
								client.close(() => {
									cs.close(() => {
										server.close(done);
									});
								});
							}, 1000);
						});
					});
				});
			});
		});
	});

	it("Client should not receive getStorageData result after closing", (done) => {
		const readKeys: playlog.StorageKey[] = [
			{ region: 1, regionKey: "foo", gameId: "10", userId: "20" },
			{ region: 1, regionKey: "bar", gameId: "20", userId: "30" },
		];
		const permission: amflow.Permission = {
			writeTick: true,
			readTick: true,
			sendEvent: false,
			subscribeEvent: false,
			subscribeTick: false,
			maxEventPriority: 0,
		};
		let clientClosed = false;

		const amflow = new MockAMFlow();
		jest
			.spyOn(amflow, "authenticate")
			.mockImplementation((token: string, callback: (err: Error, permission: amflow.Permission) => void) => {
				callback(null, permission);
			});
		jest
			.spyOn(amflow, "getStorageData")
			.mockImplementation((keys: playlog.StorageReadKey[], callback: (err: Error, values: playlog.StorageData[]) => void) => {
				setTimeout(() => {
					callback(null, [
						{ readKey: readKeys[0], values: [] },
						{ readKey: readKeys[1], values: [] },
					]);
					setTimeout(() => {
						expect(clientClosed).toBe(true);
						cs.close(() => {
							server.close(done);
						});
					});
				}, 2000);
			});
		const server = createServer(amflow).listen(0);
		const port = getBoundPort(server);
		const cs = createClientSession(port);

		cs.open(() => {
			cs.createClient((err, client) => {
				client.open("100", (err: Error) => {
					client.authenticate("foo", (err, p) => {
						setTimeout(() => {
							client.close(() => {
								cs.close(() => {
									clientClosed = true;
								});
							});
						}, 1000);
						client.getStorageData(readKeys, (err, values) => {
							client.close(() => {
								cs.close(() => {
									server.close(() => {
										done.fail();
									});
								});
							});
						});
					});
				});
			});
		});
	});

	it("Client should fail to get storage data", (done) => {
		const readKeys: playlog.StorageKey[] = [
			{ region: 1, regionKey: "foo", gameId: "10", userId: "20" },
			{ region: 1, regionKey: "bar", gameId: "20", userId: "30" },
		];
		const permission: amflow.Permission = {
			writeTick: true,
			readTick: true,
			sendEvent: false,
			subscribeEvent: false,
			subscribeTick: false,
			maxEventPriority: 0,
		};

		const amflow = new MockAMFlow();
		jest
			.spyOn(amflow, "authenticate")
			.mockImplementation((token: string, callback: (err: Error, permission: amflow.Permission) => void) => {
				callback(null, permission);
			});
		jest
			.spyOn(amflow, "getStorageData")
			.mockImplementation((keys: playlog.StorageReadKey[], callback: (err: Error, values?: playlog.StorageData[]) => void) => {
				expect(keys).toEqual(readKeys);
				callback(new Error("fail"));
			});
		const server = createServer(amflow).listen(0);
		const port = getBoundPort(server);
		const cs = createClientSession(port);

		cs.open(() => {
			cs.createClient((err, client) => {
				client.open("100", (err: Error) => {
					client.authenticate("foo", (err, p) => {
						client.getStorageData(readKeys, (err, values) => {
							expect(err).toBeTruthy();
							expect(values).toBeFalsy();
							setTimeout(() => {
								client.close(() => {
									cs.close(() => {
										server.close(done);
									});
								});
							}, 1000);
						});
					});
				});
			});
		});
	});

	it("Client should put storage data", (done) => {
		const key: playlog.StorageKey = { region: 1, regionKey: "foo", gameId: "10", userId: "20" };
		const value: playlog.StorageValue = { data: "apple" };
		const permission: amflow.Permission = {
			writeTick: true,
			readTick: true,
			sendEvent: false,
			subscribeEvent: false,
			subscribeTick: false,
			maxEventPriority: 0,
		};

		const amflow = new MockAMFlow();
		jest
			.spyOn(amflow, "authenticate")
			.mockImplementation((token: string, callback: (err: Error, permission: amflow.Permission) => void) => {
				callback(null, permission);
			});
		jest
			.spyOn(amflow, "putStorageData")
			.mockImplementation(
				(k: playlog.StorageKey, value: playlog.StorageValue, opts: any, callback: (err: Error, values?: playlog.StorageData[]) => void) => {
					expect(k).toEqual(key);
					callback(null);
				},
			);
		const server = createServer(amflow).listen(0);
		const port = getBoundPort(server);
		const cs = createClientSession(port);

		cs.open(() => {
			cs.createClient((err, client) => {
				client.open("100", (err: Error) => {
					client.authenticate("foo", (err, p) => {
						client.putStorageData(key, value, {}, (err) => {
							expect(err).toBeFalsy();
							setTimeout(() => {
								client.close(() => {
									cs.close(() => {
										server.close(done);
									});
								});
							}, 1000);
						});
					});
				});
			});
		});
	});

	it("Client should not receive putStorageData result after closing", (done) => {
		const key: playlog.StorageKey = { region: 1, regionKey: "foo", gameId: "10", userId: "20" };
		const value: playlog.StorageValue = { data: "apple" };
		const permission: amflow.Permission = {
			writeTick: true,
			readTick: true,
			sendEvent: false,
			subscribeEvent: false,
			subscribeTick: false,
			maxEventPriority: 0,
		};
		let clientClosed = false;

		const amflow = new MockAMFlow();
		jest
			.spyOn(amflow, "authenticate")
			.mockImplementation((token: string, callback: (err: Error, permission: amflow.Permission) => void) => {
				callback(null, permission);
			});
		jest
			.spyOn(amflow, "putStorageData")
			.mockImplementation(
				(k: playlog.StorageKey, value: playlog.StorageValue, opts: any, callback: (err: Error, values?: playlog.StorageData[]) => void) => {
					setTimeout(() => {
						callback(null);
						setTimeout(() => {
							expect(clientClosed).toBe(true);
							cs.close(() => {
								server.close(done);
							});
						}, 1000);
					}, 2000);
				},
			);
		const server = createServer(amflow).listen(0);
		const port = getBoundPort(server);
		const cs = createClientSession(port);

		cs.open(() => {
			cs.createClient((err, client) => {
				client.open("100", (err: Error) => {
					client.authenticate("foo", (err, p) => {
						setTimeout(() => {
							client.close(() => {
								cs.close(() => {
									clientClosed = true;
								});
							});
						}, 1000);
						client.putStorageData(key, value, {}, (err) => {
							client.close(() => {
								cs.close(() => {
									server.close(() => {
										done.fail();
									});
								});
							});
						});
					});
				});
			});
		});
	});

	it("Client should fail to put storage data", (done) => {
		const key: playlog.StorageKey = { region: 1, regionKey: "foo", gameId: "10", userId: "20" };
		const value: playlog.StorageValue = { data: "apple" };
		const permission: amflow.Permission = {
			writeTick: true,
			readTick: true,
			sendEvent: false,
			subscribeEvent: false,
			subscribeTick: false,
			maxEventPriority: 0,
		};

		const amflow = new MockAMFlow();
		jest
			.spyOn(amflow, "authenticate")
			.mockImplementation((token: string, callback: (err: Error, permission: amflow.Permission) => void) => {
				callback(null, permission);
			});
		jest
			.spyOn(amflow, "putStorageData")
			.mockImplementation(
				(k: playlog.StorageKey, value: playlog.StorageValue, opts: any, callback: (err: Error, values?: playlog.StorageData[]) => void) => {
					expect(k).toEqual(key);
					callback(new Error("fail"));
				},
			);
		const server = createServer(amflow).listen(0);
		const port = getBoundPort(server);
		const cs = createClientSession(port);

		cs.open(() => {
			cs.createClient((err, client) => {
				client.open("100", (err: Error) => {
					client.authenticate("foo", (err, p) => {
						client.putStorageData(key, value, {}, (err) => {
							expect(err).toBeTruthy();
							setTimeout(() => {
								client.close(() => {
									cs.close(() => {
										server.close(done);
									});
								});
							}, 1000);
						});
					});
				});
			});
		});
	});

	it("Client should fail reconnect with invalid session ID", (done) => {
		const amflow = new MockAMFlow();
		const server = createServer(amflow, { socketOption: { reopenTimeout: 2000 } }).listen(0);
		const port = getBoundPort(server);
		const cs = createClientSession(port, { socketOpts: { reconnectMaxRetry: 1 } });

		cs.on("error", () => {
			cs.close(() => {
				server.close(done);
			});
		});
		cs.open((err: Error) => {
			// 無理矢理セッション ID を無効なものにして再接続させる
			setTimeout(() => {
				const _cs = cs as any;
				_cs._socket.setUID("invalidsession");
				_cs._socket._socket.close();
			}, 1000);
		});
	});
});

describe("External Server(websocket)", () => {
	describe("with HTTP Server", () => {
		it("Server should use external server", (done) => {
			// http のときのような、「 client がつながるところまでチェックする」のは、
			// @akashic/playlog-server-engine の責任の範疇を逸脱してると思うので、ここには書きません。
			// テストするにしても、 @akashic/playlog-server や @akashic/akashic-testbed などのように、
			// これらのモジュールを使用する側が、結合テストの粒度で確認すべきです。
			// @akashic/playlog-server-engine で実装では使用しておらず、
			// それ自体の動作確認に必要なわけではないモジュールへの依存をむやみに増やすのは、
			// 単に他のモジュールへの依存・結合度を高めるだけで、技術的負債を増やすだなので、すべきではないと思います。
			// ただし、現状だと playlog-server 側でそのようなユースケースがカバーできるテストが書かれているかわからないので、
			// HTTP の場合のテストは、そのまま残してあります。
			const amflow = new MockAMFlow();
			const httpServer = http.createServer();
			const server = createServer(amflow, { server: httpServer });
			httpServer.listen(() => {
				const address = httpServer.address();
				if (typeof address === "string") {
					throw new Error("can't get bound port");
				}
				const port = address.port;
				const cs = createClientSession(port);
				cs.open((err) => {
					expect(err).toBeFalsy();
					setTimeout(() => {
						cs.close(() => {
							server.close(() => {
								httpServer.close(done);
							});
						});
					}, 1000);
				});
			});
		});
	});

	describe("with HTTP over SSL/TLS Server ", () => {
		it("Server should use external server", (done) => {
			const amflow = new MockAMFlow();
			const httpsServer = https.createServer({
				// ここで使用されている鍵と証明書は、このテストのためだけにつくったオレオレ証明書とその鍵で、
				//   どこかのページとかで使ったりはしていないので、セキュリティ的な問題はない。
				// ファイルで読み込むと、読み込みのテストを書かなきゃいけないので、ハードコーディングする
				key: `-----BEGIN RSA PRIVATE KEY-----
MIIEpQIBAAKCAQEA5518poOZPOwDNUYFyK2SVVkqkJcIzVVj9ylIt+4uCAqrKhx6
XvDeNX6YaIJyzCWe97kfz/qHSidGjNJZMDgPg9FE/qnvJ5Ms94I+1SnObX1nPfTH
KCowgUTnthsZ91LG3J9osV+AiH/mznZSiKxmpbKB9FuWH68kCe79ElBDVY4uiGXQ
KZojQSrbV2vtuPyTKQoJFl/GOKbbP1oejoTG39YEt1bSg/V5bIiRAsKIqaBLxHS4
bXo2rW17QZTfQbUT5KalAAVrgAJfBZVjvn0G4OohkiWV8QNDvWnQbTYbXs0pETe3
jMd4HfhKxpWYOOaC+WwvD6wFQ4PSgySmX5NnRwIDAQABAoIBAQC+vyeKJvULhD98
H0fiJnhOS9nPLGO2Xy2tvtVBjSlhvA+M5dkt2WbXXYP9BfmvAQizcUWuzd+fhUsH
7LBBEtpMMAuHQ8JOsFmnGR/QA9caut1M3Assm9pIi8vcYON4mTZnOe1JrqI3SEZ4
IGAGaR08Nw/pg4fWXjHq8GSBMZLSoG3B0nTDx9tXg5tfJPco78cIMmHV7Y78C2ip
rgb3tPNoewhvkiz7OPaf0z9x+rklRUEqsyWtTrsKEupeIeEOzYTncH552Wac+WPo
bnDI8Uf7fJ7+HXIRshUm+77FzwPsuUywFB4AQhXN3Vuq8vABaV/wQ268oq8Uinbz
ebcxl3hZAoGBAPUPIQxRxVh1Sz0EPL6L/YxWbeOv7mQbZGADCF9WyWFutxAbuV6l
ZKUsSU+aVrBSUaXj1XSilcpjoLh6BgsT3JepwhZd+T/UNv14LWz37XeKNme38Ljy
tg1b5adw4TcyXBw2N0lAW+otyV4eJdG2Qtm4Uerv+S9z76WieO/fn9fzAoGBAPH0
s82gg5vFeuO3xRf5EaOGmEj414k8xC2uOgTRw9Vt8OGdE+jC8mVJb2MncJjawYTy
O1g5RaVKvAUzq9dvMsC5vGg4vdX9XdIKdhtd7qGXXeWoANlzGGTTPgoBeph3HIHM
w4dm62P4rWzrdDSppkvx3MbCH9yaF8e1Etp6xzxdAoGBALo0DbNzqpTlQw8Q2isa
6cQppAP+mRAdtC4z/7eZlRjgbF7kAf0FhSzwMqA2sKn3UqzPKlEefNy0yNmDdnYS
WGoxBhXCv/IdCM+d8j47QIe1UFOM829ElMofyqdo4Of07wJMu8OAEJcmxTwrgicP
60nNgQkX4GqLGEvt4SC69ZS7AoGAWGrQrerjTTA8OSz1pE4LSROtYLU2plsDYaIS
Z6J0CvFzHi81kFB1HdhZEQXfmqwOHdQbJaFANyf5T3lTaZWkGVOGaxuZG7LL7y6N
fHC1/G0BDiR3sv7hQi8Ds8pYj5CvZSt7pGZSzKSaU3wzae846vXGdQeJdycEW6Fq
81X8qq0CgYEAymdI/H9dakHci4FGD8PHhr3zUz+k9U5NkGB0r8hHtOL0Jgd3znx4
mFVJ4NEVncfsBBEDcU/5xEh6N571l0sU61F3WlXRzNF15M3au2ghiG7WLgLFJdK2
0JHZcZlq4KllkAZPd63cehTp/+I7XMDuKNGFxoqkmm/rui+dpQVulMs=
-----END RSA PRIVATE KEY-----`,
				// ファイルで読み込むと、読み込みのテストを書かなきゃいけないので、ハードコーディングする
				cert: `-----BEGIN CERTIFICATE-----
MIIDADCCAegCCQDFED4szJl6yzANBgkqhkiG9w0BAQUFADBCMQswCQYDVQQGEwJY
WDEVMBMGA1UEBwwMRGVmYXVsdCBDaXR5MRwwGgYDVQQKDBNEZWZhdWx0IENvbXBh
bnkgTHRkMB4XDTE3MDQyNTA3MDAxMVoXDTI0MDcyNzA3MDAxMVowQjELMAkGA1UE
BhMCWFgxFTATBgNVBAcMDERlZmF1bHQgQ2l0eTEcMBoGA1UECgwTRGVmYXVsdCBD
b21wYW55IEx0ZDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAOedfKaD
mTzsAzVGBcitklVZKpCXCM1VY/cpSLfuLggKqyocel7w3jV+mGiCcswlnve5H8/6
h0onRozSWTA4D4PRRP6p7yeTLPeCPtUpzm19Zz30xygqMIFE57YbGfdSxtyfaLFf
gIh/5s52UoisZqWygfRblh+vJAnu/RJQQ1WOLohl0CmaI0Eq21dr7bj8kykKCRZf
xjim2z9aHo6Ext/WBLdW0oP1eWyIkQLCiKmgS8R0uG16Nq1te0GU30G1E+SmpQAF
a4ACXwWVY759BuDqIZIllfEDQ71p0G02G17NKRE3t4zHeB34SsaVmDjmgvlsLw+s
BUOD0oMkpl+TZ0cCAwEAATANBgkqhkiG9w0BAQUFAAOCAQEApEntvmd9sE1C7tVk
PYsZTZcbSu9pO3+14CfJQaWr4uIg3D16RTygDmuUlSTpGKGMbixSQQM5dGXousBP
DQXlICbuFmKYZEB26s5nPPoA+qs4O1wvEsJTqnMTaI9s3JPO8eP2Hh5FhiAyMW++
n+6kbbqdEBNYGBBXQLnk/lv3+Cc139nokI+WiFkWAsstxqrK4F2pDzE5NmcKTt/S
OAqTca6RdlHmfrlUuddb00vwyGQxxYd8kgDV52I+tA1dUDIKRQdKBbTq4uUckR44
GE/0FF+yfZYzeWBuUP4k0upnyJCv9y+Hy6JsZ8VA8DHJtlgaSbM8S79T8Qo0+vzW
0bmo1Q==
-----END CERTIFICATE-----`,
			});
			const server = createServer(amflow, { server: httpsServer });
			httpsServer.listen(() => {
				server.close(() => {
					httpsServer.close(done);
				});
			});
		});
	});
});
