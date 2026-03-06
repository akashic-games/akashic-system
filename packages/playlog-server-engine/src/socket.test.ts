import * as http from "http";
import * as querystring from "querystring";
import * as url from "url";
import ws from "ws";
import * as Socket from "./Socket";
import { TestServer as Server } from "./TestServer";

describe("Socket", () => {
	function createClient(port: number, uid: string): ws {
		return new ws("ws://localhost:" + port + "/?uid=" + uid);
	}

	function createSocket(socket: ws, request: http.IncomingMessage, option?: Socket.Option): Socket.WSSocket {
		return new Socket.WSSocket(socket, request, option);
	}

	function parseUid(request: http.IncomingMessage): string {
		const query = url.parse(request.url || "").query;
		return querystring.parse(query || "").uid as string;
	}

	it("should recieve", (done) => {
		const server = new Server();
		const c1 = createClient(server.port, "client1");

		let c1sock: Socket.Socket = null;
		server.wsServer.on("connection", (socket, request) => {
			c1sock = createSocket(socket, request);
			c1sock.recv(async (data) => {
				expect(data.toString()).toBe("foo");
				c1sock.close();
				await server.close();
				done();
			});
		});

		c1.on("open", () => {
			c1.send(Buffer.from("foo"));
		});
	});

	it("should send", (done) => {
		const server = new Server();
		const c1 = createClient(server.port, "client1");

		let c1sock: Socket.Socket = null;
		server.wsServer.on("connection", (socket, request) => {
			c1sock = createSocket(socket, request);
			c1sock.send(Buffer.from("bar"));
		});

		c1.on("message", async (data: Buffer) => {
			expect(data.toString()).toBe("bar");
			c1sock.close();
			await server.close();
			done();
		});
	});

	it("送信が一定量遅延している場合、loggerにwarnが出力される", (done) => {
		const server = new Server();
		const c1 = createClient(server.port, "client1");
		const loggerMock = {
			error: jest.fn(),
			warn: jest.fn(),
		};

		let c1sock: Socket.WSSocket;
		server.wsServer.on("connection", (socket, request) => {
			jest.spyOn(socket, "bufferedAmount", "get").mockReturnValue(Socket.BUFFERED_AMOUNT_WARN_THRESHOLD + 1); // 常にwarnの基準を1超えた値を返す用に細工する
			c1sock = createSocket(socket, request);
			c1sock.logger = loggerMock;

			c1sock.send(Buffer.from("bar"));
		});

		c1.on("message", async (data: Buffer) => {
			expect(data.toString()).toBe("bar");
			expect(loggerMock.warn.mock.calls.length).toBe(1);

			c1sock.close();
			await server.close();
			done();
		});
	});

	it("送信がさらに遅延している場合、loggerにerrorが出力される", (done) => {
		const server = new Server();
		const c1 = createClient(server.port, "client1");
		const loggerMock = {
			error: jest.fn(),
			warn: jest.fn(),
		};

		let c1sock!: Socket.WSSocket;
		server.wsServer.on("connection", (socket, request) => {
			jest.spyOn(socket, "bufferedAmount", "get").mockReturnValue(Socket.BUFFERED_AMOUNT_ERROR_THRESHOLD + 1); // 常にwarnの基準を1超えた値を返す用に細工する
			c1sock = createSocket(socket, request);
			c1sock.logger = loggerMock;

			c1sock.send(Buffer.from("bar"));
		});

		c1.on("message", async (data: Buffer) => {
			expect(data.toString()).toBe("bar");
			expect(loggerMock.error.mock.calls.length).toBe(1);

			c1sock.close();
			await server.close();
			done();
		});
	});

	it("should close", (done) => {
		const server = new Server();
		const c1 = createClient(server.port, "client1");

		let c1sock: Socket.Socket = null;
		let c1Closed = false;
		let c1sockClosed = false;
		server.wsServer.on("connection", (socket, request) => {
			c1sock = createSocket(socket, request);
			c1sock.on("close", async () => {
				c1sockClosed = true;
				if (c1Closed) {
					await server.close();
					done();
				}
			});
			c1sock.close();
		});

		c1.on("error", async () => {
			await server.close();
			done.fail();
		});
		c1.on("message", async () => {
			await server.close();
			done.fail();
		});
		c1.on("close", async () => {
			c1Closed = true;
			if (c1sockClosed) {
				await server.close();
				done();
			}
		});
	});

	it("should emit timeout", (done) => {
		const server = new Server();

		server.wsServer.on("connection", (socket, request) => {
			const c1sock = createSocket(socket, request, { reopenTimeout: 2 * 100 });
			c1sock.on("close", async () => {
				await server.close();
				done.fail();
			});
			c1sock.on("timeout", async () => {
				await server.close();
				done();
			});
		});

		const c1 = createClient(server.port, "client1");
		c1.on("open", () => {
			setTimeout(() => {
				c1.close();
			}, 100);
		});
	});

	it("should attach new socket", (done) => {
		const server = new Server();
		let c1sock: Socket.Socket | null = null;

		server.wsServer.on("connection", async (socket, request) => {
			let c1Disconnected = false;
			let c1Attached = false;

			const uid = parseUid(request);
			if (uid === "client1-1") {
				c1sock = createSocket(socket, request, { reopenTimeout: 2 * 100 });
				c1sock.on("close", async () => {
					await server.close();
					done();
				});
				c1sock.on("disconnected", () => {
					expect(c1Attached).toBe(false);
					c1Disconnected = true;
				});
				c1sock.on("attached", () => {
					expect(c1Disconnected).toBe(true);
					c1Attached = true;
				});
				c1sock.on("timeout", async () => {
					await server.close();
					done.fail();
				});
				c1sock.recv((data) => {
					expect(data.toString()).toBe("foo");
					expect(c1Disconnected).toBe(true);
					expect(c1Attached).toBe(true);
					c1sock.close();
				});
			} else if (uid === "client1-2") {
				if (c1sock != null) {
					c1sock.attach(socket);
				}
			} else {
				await server.close();
				done.fail();
			}
		});

		const c1 = createClient(server.port, "client1-1");

		c1.on("open", () => {
			c1.close();
			setTimeout(() => {
				const c2 = createClient(server.port, "client1-2");
				c2.on("open", () => {
					c2.send(Buffer.from("foo"));
				});
			}, 100);
		});
	});

	it("should emit error", (done) => {
		const server = new Server();
		server.wsServer.on("connection", (socket, request) => {
			const c1sock = createSocket(socket, request);
			c1sock.on("error", (err: Error) => {
				expect(err).toBeTruthy();
				setTimeout(() => {
					c1sock.close();
				}, 1000);
			});
			c1sock.on("close", async () => {
				await server.close();
				done();
			});
		});

		const c1 = createClient(server.port, "client1");
		c1.on("open", () => {
			c1.send("string", { binary: false });
		});
	});

	it("server should close when recv handler throws error", (done) => {
		const server = new Server();
		const recvError = new Error("thrown-by-recv");

		server.wsServer.on("connection", (socket, request) => {
			const serverSocket = createSocket(socket, request);
			serverSocket.recv(() => {
				throw recvError;
			});
			serverSocket.on("error", (err) => {
				expect(err).toEqual(recvError);
			});
			serverSocket.on("close", () => {
				server.close();
				done();
			});
		});
		// エラーが発生したときに、close までされなかった場合、このテストケースはタイムアウトで Fail する。

		const client = createClient(server.port, "client1");
		client.on("open", () => {
			client.send(Buffer.from("foo"));
		});
	});

	it("should ping/pong for keeping alive", (done) => {
		const server = new Server();
		let c1sock: Socket.Socket = null;
		const timeout = 100;
		server.wsServer.on("connection", (socket, request) => {
			c1sock = createSocket(socket, request, { _wsKeepAliveTimeout: timeout * 10, _wsKeepAliveInterval: timeout, reopenTimeout: 10000 });
			c1sock.on("close", async () => {
				await server.close();
				done();
			});
		});

		const c1 = createClient(server.port, "client1");
		let before = 0;
		let pingCount = 0;
		const acceptable = timeout / 2;
		c1.on("ping", () => {
			pingCount++;
			if (!before) {
				before = Date.now();
				return;
			}
			const now = Date.now();
			expect(now - before).toBeGreaterThan(timeout - acceptable / 2);
			expect(now - before).toBeLessThan(timeout + acceptable / 2);
			before = now;
			if (pingCount === 5) {
				c1sock.close();
			}
		});
	});

	it("should not ping if the readyState is CLOSING or CLOSED", (done) => {
		const server = new Server();
		let pingCount = 0;

		server.wsServer.on("connection", async (socket, request) => {
			const wsSocket = new Socket.WSSocket(socket, request, { _wsKeepAliveTimeout: 100, _wsKeepAliveInterval: 10 });
			wsSocket.on("error", async () => {
				await server.close();
				done.fail();
			});

			// closed raw socket:
			socket.close();
			expect(socket.readyState === ws.CLOSING || socket.readyState === ws.CLOSED).toBe(true);

			// no effect:
			wsSocket.ping();

			setTimeout(async () => {
				expect(pingCount).toBe(0);
				// ping が実行されないのでデータ部の有無に関わらず bufferedAmount はゼロになるはず:
				expect(socket.bufferedAmount).toBe(0);
				await server.close();
				done();
			}, 100);
		});

		const client = createClient(server.port, "client1");
		client.on("ping", () => {
			++pingCount;
		});
	});
});
