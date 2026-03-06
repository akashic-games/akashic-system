import * as amflow from "@akashic/amflow";
import * as playlog from "@akashic/playlog";
import * as playlogClient from "./";

const SOCKET_TYPE = playlogClient.Socket.Type.WebSocket;

describe("Client", () => {
	let originalTimeout: number;
	beforeEach(() => {
		originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
		jasmine.DEFAULT_TIMEOUT_INTERVAL = 30 * 1000;
	});

	afterEach(() => {
		jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
	});

	function createSession(): Promise<playlogClient.Session> {
		return new Promise<playlogClient.Session>((resolve, reject) => {
			const s = new playlogClient.Session("ws://" + location.host, { socketType: SOCKET_TYPE });
			s.open((error) => {
				if (error) {
					return reject();
				}
				resolve(s);
			});
		});
	}
	function createClient(session: playlogClient.Session): Promise<playlogClient.Client> {
		return new Promise<playlogClient.Client>((resolve, reject) => {
			session.createClient((error, client) => {
				if (error) {
					return reject(error);
				}
				resolve(client);
			});
		});
	}
	describe("passive", () => {
		let session: playlogClient.Session = null;
		let client: playlogClient.Client = null;
		it("constructor", (done) => {
			createSession()
				.then((s) => {
					session = s;
					return createClient(session);
				})
				.then((c) => {
					client = c;
					done();
				})
				.catch(done.fail);
		});
		it("open", (done) => {
			client.open("--auto-tick-stream", (err: Error) => {
				expect(err).toBe(null);
				done();
			});
		});
		it("authenticate", (done) => {
			client.authenticate("passive", (err: Error, permission: amflow.Permission) => {
				expect(err).toBe(null);
				done();
			});
		});
		it("onTick/offTick", (done) => {
			let count1 = 0;
			let count2 = 0;
			const handler1 = (tick: playlog.Tick) => {
				count1++;
				if (count1 === 10) {
					client.onTick(handler2);
				}
				if (count1 === 20) {
					client.offTick(handler1);
				}
			};
			const handler2 = (tick: playlog.Tick) => {
				count2++;
				if (count2 === 30) {
					client.offTick(handler2);
					expect(count1).toBe(20);
					done();
				}
			};
			client.onTick(handler1);
		});
		it("onEvent - not fire", (done) => {
			let count = 0;
			const handler = (event: playlog.Event) => {
				count++;
			};
			client.onEvent(handler);
			setTimeout(() => {
				expect(count).toBe(0);
				client.offEvent(handler);
				done();
			}, 1000);
		});
		it("getTickList", (done) => {
			let count = 0;
			client.getTickList(1, 100, (err: Error, tickList: playlog.TickList) => {
				count++;
				if (count === 2) {
					done();
				}
			});
			client.getTickList(300, 350, (err: Error, tickList: playlog.TickList) => {
				count++;
				if (count === 2) {
					done();
				}
			});
		});
		it("getStartPoint - first", (done) => {
			client.getStartPoint({}, (err: Error, startPoint: amflow.StartPoint) => {
				expect(startPoint.frame).toBe(0);
				done();
			});
		});
		it("getStartPoint - mid", (done) => {
			client.getStartPoint({ frame: 50 }, (err: Error, startPoint: amflow.StartPoint) => {
				expect(startPoint.frame <= 50).toBe(true);
				done();
			});
		});
		it("putStartPoint - PermissionError", (done) => {
			client.putStartPoint({ frame: 50, data: "baz", timestamp: 0 }, (err: Error) => {
				expect(err.name).toBe("PermissionError");
				done();
			});
		});
		it("sendTick - PermissionError", () => {
			expect(function () {
				client.sendTick([100]);
			}).toThrowError();
		});
		it("getStorageData - PermissionError", (done) => {
			const keys: playlog.StorageKey[] = [
				{ region: 1, regionKey: "foo", gameId: "10", userId: "20" },
				{ region: 1, regionKey: "bar", gameId: "20", userId: "30" },
			];
			client.getStorageData(keys, (err: Error, values: playlog.StorageData[]) => {
				expect(err.name).toBe("PermissionError");
				done();
			});
		});
		it("putStorageData - PermissionError", (done) => {
			const key: playlog.StorageKey = { region: 1, regionKey: "foo", gameId: "10", userId: "20" };
			const value: playlog.StorageValue = { data: "apple" };
			client.putStorageData(key, value, {}, (err: Error) => {
				expect(err.name).toBe("PermissionError");
				done();
			});
		});
		it("close", (done) => {
			client.close((err: Error) => {
				if (err) {
					done.fail(err);
				}
				session.close(done);
			});
		});
	});
	describe("active", () => {
		let session: playlogClient.Session = null;
		let client: playlogClient.Client = null;
		it("constructor", (done) => {
			createSession()
				.then((s) => {
					session = s;
					return createClient(session);
				})
				.then((c) => {
					client = c;
					done();
				})
				.catch(done.fail);
		});
		it("open", (done) => {
			client.open("--auto-event-stream", (err: Error) => {
				expect(err).toBe(null);
				done();
			});
		});
		it("authenticate", (done) => {
			client.authenticate("active", (err: Error, permission: amflow.Permission) => {
				expect(err).toBe(null);
				done();
			});
		});
		it("onTick - not fire", (done) => {
			client.onTick((tick: playlog.Tick) => {
				done.fail();
			});
			setTimeout(() => {
				done();
			}, 1000);
		});
		it("onEvent", (done) => {
			let count1 = 0;
			let count2 = 0;
			const handler1 = (event: playlog.Event) => {
				count1++;
				if (count1 === 5) {
					client.onEvent(handler2);
				}
				if (count1 === 10) {
					client.offEvent(handler1);
				}
			};
			const handler2 = (event: playlog.Event) => {
				count2++;
				if (count2 === 15) {
					client.offEvent(handler2);
					expect(count1).toBe(10);
					done();
				}
			};
			client.onEvent(handler1);
		});
		it("getTickList", (done) => {
			let count = 0;
			client.getTickList(1, 100, (err: Error, tickList: playlog.TickList) => {
				count++;
				if (count === 2) {
					done();
				}
			});
			client.getTickList(300, 350, (err: Error, tickList: playlog.TickList) => {
				count++;
				if (count === 2) {
					done();
				}
			});
		});
		it("getStartPoint - first", (done) => {
			client.getStartPoint({}, (err: Error, startPoint: amflow.StartPoint) => {
				expect(startPoint.frame).toBe(0);
				done();
			});
		});
		it("getStartPoint - mid", (done) => {
			client.getStartPoint({ frame: 50 }, (err: Error, startPoint: amflow.StartPoint) => {
				expect(startPoint.frame <= 50).toBe(true);
				done();
			});
		});
		it("putStartPoint", (done) => {
			client.putStartPoint({ frame: 50, data: "baz", timestamp: 0 }, (err: Error) => {
				done();
			});
		});
		it("getStorageData", (done) => {
			const keys: playlog.StorageKey[] = [
				{ region: 1, regionKey: "foo", gameId: "10", userId: "20" },
				{ region: 1, regionKey: "bar", gameId: "20", userId: "30" },
			];
			client.getStorageData(keys, (err: Error, values: playlog.StorageData[]) => {
				expect(err).toBe(null);
				done();
			});
		});
		it("putStorageData", (done) => {
			const key: playlog.StorageKey = { region: 1, regionKey: "foo", gameId: "10", userId: "20" };
			const value: playlog.StorageValue = { data: "apple" };
			client.putStorageData(key, value, {}, (err: Error) => {
				expect(err).toBe(null);
				done();
			});
		});
		it("close", (done) => {
			client.close((err: Error) => {
				if (err) {
					done.fail(err);
				}
				session.close(done);
			});
		});
	});
	describe("server fails requests", () => {
		let session: playlogClient.Session = null;
		let client: playlogClient.Client = null;
		it("constructor", (done) => {
			createSession()
				.then((s) => {
					session = s;
					return createClient(session);
				})
				.then((c) => {
					client = c;
					done();
				})
				.catch(done.fail);
		});
		it("open", (done) => {
			client.open("--fail-requests", (err: Error) => {
				expect(err).toBe(null);
				done();
			});
		});
		it("authenticate", (done) => {
			client.authenticate("full", (err: Error, permission: amflow.Permission) => {
				expect(err).toBe(null);
				done();
			});
		});
		it("getTickList", (done) => {
			client.getTickList(100, 200, (err: Error, tickList: playlog.TickList) => {
				expect(err.name).toBe("RuntimeError");
				done();
			});
		});
		it("getStartPoint", (done) => {
			client.getStartPoint({ frame: 50 }, (err: Error, startPoint: amflow.StartPoint) => {
				expect(err.name).toBe("RuntimeError");
				done();
			});
		});
		it("putStartPoint", (done) => {
			client.putStartPoint({ frame: 50, data: "baz", timestamp: 0 }, (err: Error) => {
				expect(err.name).toBe("RuntimeError");
				done();
			});
		});
		it("getStorageData", (done) => {
			const keys: playlog.StorageKey[] = [
				{ region: 1, regionKey: "foo", gameId: "10", userId: "20" },
				{ region: 1, regionKey: "bar", gameId: "20", userId: "30" },
			];
			client.getStorageData(keys, (err: Error, values: playlog.StorageData[]) => {
				expect(err.name).toBe("RuntimeError");
				done();
			});
		});
		it("putStorageData", (done) => {
			const key: playlog.StorageKey = { region: 1, regionKey: "foo", gameId: "10", userId: "20" };
			const value: playlog.StorageValue = { data: "apple" };
			client.putStorageData(key, value, {}, (err: Error) => {
				expect(err.name).toBe("RuntimeError");
				client.close(() => {
					session.close(done);
				});
			});
		});
	});
	describe("multiple clients", () => {
		let activeSession: playlogClient.Session = null;
		let passiveSession: playlogClient.Session = null;
		let activeClient: playlogClient.Client = null;
		let passiveClient: playlogClient.Client = null;
		const client: playlogClient.Client = null;
		it("open", (done) => {
			createSession()
				.then((s) => {
					activeSession = s;
					return createClient(activeSession);
				})
				.then((c) => {
					activeClient = c;
					return createSession();
				})
				.then((s) => {
					passiveSession = s;
					return createClient(passiveSession);
				})
				.then((c) => {
					passiveClient = c;
				})
				.then(() => {
					activeClient.open("200", (err) => {
						if (err) {
							done.fail(err);
						}
						passiveClient.open("200", (err) => {
							if (err) {
								done.fail(err);
							}
							done();
						});
					});
				})
				.catch(done.fail);
		});
		it("authenticate", (done) => {
			activeClient.authenticate("active", (err, permission) => {
				if (err) {
					done.fail(err);
				}
				passiveClient.authenticate("passive", (err, permission) => {
					if (err) {
						done.fail(err);
					}
					done();
				});
			});
		});
		it("sendTick/onTick", (done) => {
			let timer: NodeJS.Timer = null;
			let frame = 1;
			activeClient.onTick((tick) => {
				done.fail();
			});
			passiveClient.onTick((tick) => {
				if (tick[0] === 30) {
					clearInterval(timer);
					done();
				}
			});
			timer = setInterval(() => {
				activeClient.sendTick([frame++]);
			}, 33);
		});
		it("sendEvent/onEvent", (done) => {
			const events: playlog.Event[] = [];
			const limit = 100;
			let timer: NodeJS.Timer = null;
			let sendIdx = 0;
			for (let i = 0; i < limit; ++i) {
				events.push([0x21, 2, "tom", i, 20, 30, 100]);
			}
			activeClient.onEvent((event) => {
				if (event[3] === limit - 1) {
					done();
				}
			});
			passiveClient.onEvent((event) => {
				done.fail();
			});
			timer = setInterval(() => {
				passiveClient.sendEvent(events[sendIdx++]);
				if (sendIdx === limit) {
					clearInterval(timer);
				}
			}, 33);
		});
		it("close", (done) => {
			activeClient.close((err: Error) => {
				if (err) {
					done.fail(err);
				}
				passiveClient.close((err: Error) => {
					if (err) {
						done.fail(err);
					}
					activeSession.close(() => {
						passiveSession.close(done);
					});
				});
			});
		});
	});
	describe("reopen", () => {
		let session: playlogClient.Session = null;
		let client: playlogClient.Client = null;
		it("constructor", (done) => {
			createSession()
				.then((s) => {
					session = s;
					return createClient(session);
				})
				.then((c) => {
					client = c;
					done();
				})
				.catch(done.fail);
		});
		it("open", (done) => {
			client.open("--auto-tick-stream", (err: Error) => {
				expect(err).toBe(null);
				done();
			});
		});
		it("authenticate", (done) => {
			client.authenticate("passive", (err: Error, permission: amflow.Permission) => {
				expect(err).toBe(null);
				done();
			});
		});
		it("onTick", (done) => {
			let count = 0;
			client.onTick((tick: playlog.Tick) => {
				count++;
				if (count === 20) {
					client.close((err) => {
						if (err) {
							done.fail(err);
						}
						done();
					});
				}
			});
		});
		it("getTickList - InvalidState", (done) => {
			client.getTickList(1, 100, (err: Error, tickList: playlog.TickList) => {
				expect(err.name).toBe("InvalidState");
				done();
			});
		});
		it("reopen", (done) => {
			client.open("--auto-tick-stream", (err: Error) => {
				expect(err).toBe(null);
				done();
			});
		});
		it("authenticate - again", (done) => {
			client.authenticate("passive", (err: Error, permission: amflow.Permission) => {
				expect(err).toBe(null);
				done();
			});
		});
		it("onTick - again", (done) => {
			let count = 0;
			client.onTick((tick: playlog.Tick) => {
				count++;
				if (count === 20) {
					client.close((err) => {
						if (err) {
							done.fail(err);
						}
						session.close(done);
					});
				}
			});
		});
	});
	describe("multiple clients in one session", () => {
		let session: playlogClient.Session = null;
		let activeClient: playlogClient.Client = null;
		let passiveClient: playlogClient.Client = null;
		const client: playlogClient.Client = null;
		it("open", (done) => {
			createSession()
				.then((s) => {
					session = s;
					return createClient(session);
				})
				.then((c) => {
					activeClient = c;
					return createClient(session);
				})
				.then((c) => {
					passiveClient = c;
				})
				.then(() => {
					activeClient.open("200", (err) => {
						if (err) {
							done.fail(err);
						}
						passiveClient.open("200", (err) => {
							if (err) {
								done.fail(err);
							}
							done();
						});
					});
				})
				.catch(done.fail);
		});
		it("authenticate", (done) => {
			activeClient.authenticate("active", (err, permission) => {
				if (err) {
					done.fail(err);
				}
				passiveClient.authenticate("passive", (err, permission) => {
					if (err) {
						done.fail(err);
					}
					done();
				});
			});
		});
		it("sendTick/onTick", (done) => {
			let timer: NodeJS.Timer = null;
			let frame = 1;
			activeClient.onTick((tick) => {
				done.fail();
			});
			passiveClient.onTick((tick) => {
				if (tick[0] === 30) {
					clearInterval(timer);
					done();
				}
			});
			timer = setInterval(() => {
				activeClient.sendTick([frame++]);
			}, 33);
		});
		it("sendEvent/onEvent", (done) => {
			const events: playlog.Event[] = [];
			const limit = 100;
			let timer: NodeJS.Timer = null;
			let sendIdx = 0;
			for (let i = 0; i < limit; ++i) {
				events.push([0x21, 2, "tom", i, 20, 30, 100]);
			}
			activeClient.onEvent((event) => {
				if (event[3] === limit - 1) {
					done();
				}
			});
			passiveClient.onEvent((event) => {
				done.fail();
			});
			timer = setInterval(() => {
				passiveClient.sendEvent(events[sendIdx++]);
				if (sendIdx === limit) {
					clearInterval(timer);
				}
			}, 33);
		});
		it("close", (done) => {
			activeClient.close((err: Error) => {
				if (err) {
					done.fail(err);
				}
				passiveClient.close((err: Error) => {
					if (err) {
						done.fail(err);
					}
					session.close(done);
				});
			});
		});
	});
	describe("ignore closing/closed client callback", () => {
		it("authenticate", (done) => {
			let session: playlogClient.Session;
			createSession()
				.then((s) => {
					session = s;
					return createClient(session);
				})
				.then((client) => {
					client.open("--auto-tick-stream", (err: Error) => {
						expect(err).toBe(null);
						client.authenticate("full", (err: Error, permission: amflow.Permission) => done.fail());
						client.close((err: Error) => {
							if (err) {
								done.fail(err);
							}
							session.close(done);
						});
					});
				})
				.catch(done.fail);
		});
		it("onTick", (done) => {
			let session: playlogClient.Session;
			createSession()
				.then((s) => {
					session = s;
					return createClient(session);
				})
				.then((client) => {
					client.open("--auto-tick-stream", (err: Error) => {
						expect(err).toBe(null);
						client.authenticate("full", (err: Error, permission: amflow.Permission) => {
							let closing = false;
							client.onTick((tick) => {
								if (closing) {
									done.fail();
								}
							});
							setTimeout(() => {
								closing = true;
								client.close((err: Error) => {
									if (err) {
										done.fail(err);
									}
									session.close(done);
								});
							}, 1000);
						});
					});
				})
				.catch(done.fail);
		});
		it("onEvent", (done) => {
			let session: playlogClient.Session;
			createSession()
				.then((s) => {
					session = s;
					return createClient(session);
				})
				.then((client) => {
					client.open("--auto-event-stream", (err: Error) => {
						expect(err).toBe(null);
						client.authenticate("full", (err: Error, permission: amflow.Permission) => {
							let closing = false;
							client.onEvent((event) => {
								if (closing) {
									done.fail();
								}
							});
							setTimeout(() => {
								closing = true;
								client.close((err: Error) => {
									if (err) {
										done.fail(err);
									}
									session.close(done);
								});
							}, 1000);
						});
					});
				})
				.catch(done.fail);
		});
		it("getTickList", (done) => {
			let session: playlogClient.Session;
			createSession()
				.then((s) => {
					session = s;
					return createClient(session);
				})
				.then((client) => {
					client.open("--auto-tick-stream", (err: Error) => {
						expect(err).toBe(null);
						client.authenticate("full", (err: Error, permission: amflow.Permission) => {
							client.getTickList(1, 100, (err: Error, tickList: playlog.TickList) => done.fail());
							client.close((err: Error) => {
								if (err) {
									done.fail(err);
								}
								session.close(done);
							});
						});
					});
				})
				.catch(done.fail);
		});
		it("putStartPoint", (done) => {
			let session: playlogClient.Session;
			createSession()
				.then((s) => {
					session = s;
					return createClient(session);
				})
				.then((client) => {
					client.open("--auto-tick-stream", (err: Error) => {
						expect(err).toBe(null);
						client.authenticate("full", (err: Error, permission: amflow.Permission) => {
							client.putStartPoint({ frame: 50, data: "baz", timestamp: 0 }, (err: Error) => done.fail());
							client.close((err: Error) => {
								if (err) {
									done.fail(err);
								}
								session.close(done);
							});
						});
					});
				})
				.catch(done.fail);
		});
		it("getStartPoint", (done) => {
			let session: playlogClient.Session;
			createSession()
				.then((s) => {
					session = s;
					return createClient(session);
				})
				.then((client) => {
					client.open("--auto-tick-stream", (err: Error) => {
						expect(err).toBe(null);
						client.authenticate("full", (err: Error, permission: amflow.Permission) => {
							client.getStartPoint({ frame: 50 }, (err: Error, startPoint: amflow.StartPoint) => done.fail());
							client.close((err: Error) => {
								if (err) {
									done.fail(err);
								}
								session.close(done);
							});
						});
					});
				})
				.catch(done.fail);
		});
		it("getStorageData", (done) => {
			let session: playlogClient.Session;
			createSession()
				.then((s) => {
					session = s;
					return createClient(session);
				})
				.then((client) => {
					client.open("--auto-tick-stream", (err: Error) => {
						expect(err).toBe(null);
						client.authenticate("full", (err: Error, permission: amflow.Permission) => {
							const keys: playlog.StorageKey[] = [
								{ region: 1, regionKey: "foo", gameId: "10", userId: "20" },
								{ region: 1, regionKey: "bar", gameId: "20", userId: "30" },
							];
							client.getStorageData(keys, (err: Error, values: playlog.StorageData[]) => done.fail());
							client.close((err: Error) => {
								if (err) {
									done.fail(err);
								}
								session.close(done);
							});
						});
					});
				})
				.catch(done.fail);
		});
		it("putStorageData", (done) => {
			let session: playlogClient.Session;
			createSession()
				.then((s) => {
					session = s;
					return createClient(session);
				})
				.then((client) => {
					client.open("--auto-tick-stream", (err: Error) => {
						expect(err).toBe(null);
						client.authenticate("full", (err: Error, permission: amflow.Permission) => {
							const key: playlog.StorageKey = { region: 1, regionKey: "foo", gameId: "10", userId: "20" };
							const value: playlog.StorageValue = { data: "apple" };
							client.putStorageData(key, value, {}, (err: Error) => done.fail());
							client.close((err: Error) => {
								if (err) {
									done.fail(err);
								}
								session.close(done);
							});
						});
					});
				})
				.catch(done.fail);
		});
	});
});
