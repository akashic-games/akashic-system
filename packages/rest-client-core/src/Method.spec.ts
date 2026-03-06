import http = require("http");
import net = require("net");
import url = require("url");
import rc = require("./");

interface FooEntity {
	id: number;
	hoge: string;
}

class TestServer {
	private errorCodes: { [key: number]: string } = {
		200: "OK",
		404: "NOT_FOUND",
	};
	private options: any;
	private called = false;
	private server?: http.Server;
	private testFunc: (req: http.IncomingMessage) => Promise<[number, any]>;

	constructor(testFunc: (req: http.IncomingMessage) => Promise<[number, any] | any>, options?: any) {
		this.testFunc = testFunc;
		this.options = options || {};
	}

	public listen(port: number) {
		this.server = http
			.createServer((req, res) => {
				this.testFunc(req).then((tuple) => {
					res.writeHead(tuple[0], this.errorCodes[tuple[0]], { "Content-Type": "application/json" });
					this.called = true;
					const result: any = {
						meta: {
							status: tuple[0],
							debug: "testServer",
						},
						data: tuple[1],
					};
					if (this.options.snake) {
						result.meta["error-code"] = this.errorCodes[tuple[0]];
					} else {
						result.meta.errorCode = this.errorCodes[tuple[0]];
					}
					res.end(JSON.stringify(result));
				});
			})
			.listen(port);

		return this;
	}

	public close() {
		if (this.server == null) {
			throw new Error("Logic Exception: server is not listening.");
		}
		this.server.close();
	}

	public isCalled(): boolean {
		return this.called;
	}
}

xdescribe("Method", () => {
	it("test-call-get", (cb) => {
		const expectedResult: FooEntity = {
			id: 123,
			hoge: "fuga",
		};
		const server = new TestServer((req) => {
			const pu = url.parse(req.url as string, true);
			expect("/foo/123").toEqual(pu.pathname);
			expect("?1#://").toEqual(pu.query.bar);
			return Promise.resolve<[number, any]>([200, expectedResult]);
		}).listen(37444);

		const apiInfo: rc.NicoApiInfo = {
			method: "GET",
			url: "http://localhost:37444/foo/:fooId?bar=:barCond",
		};
		const method = new rc.Method<FooEntity>(apiInfo);

		method
			.exec({
				fooId: 123,
				barCond: "?1#://",
			})
			.then((data) => {
				expect(200).toEqual(data.meta.status);
				expect("OK").toEqual(data.meta.errorCode);
				expect(expectedResult).toEqual(data.data);
			})
			.then(() => {
				expect(true).toEqual(server.isCalled());
				server.close();
				cb();
			})
			.catch((error) =>
				setImmediate(() => {
					throw error;
				}),
			);
	});

	it("test-call-get-with-header", (cb) => {
		const expectedResult: FooEntity = {
			id: 123,
			hoge: "fuga",
		};
		const server = new TestServer((req) => {
			const pu = url.parse(req.url as string, true);
			expect("/foo/123").toEqual(pu.pathname);
			expect("?1#://").toEqual(pu.query.bar);
			expect("example.com").toEqual(req.headers.host);
			return Promise.resolve<[number, any]>([200, expectedResult]);
		}).listen(37445);

		const apiInfo: rc.NicoApiInfo = {
			method: "GET",
			url: "http://localhost:37445/foo/:fooId?bar=:barCond",
		};
		const method = new rc.Method<FooEntity>(apiInfo);

		method
			.exec(
				{
					fooId: 123,
					barCond: "?1#://",
				},
				null,
				{
					host: "example.com",
				},
			)
			.then((data) => {
				expect(200).toEqual(data.meta.status);
				expect("OK").toEqual(data.meta.errorCode);
				expect(expectedResult).toEqual(data.data);
			})
			.then(() => {
				expect(true).toEqual(server.isCalled());
				server.close();
				cb();
			})
			.catch((error) =>
				setImmediate(() => {
					throw error;
				}),
			);
	});

	it("test-call-get-snake", (cb) => {
		const expectedResult: FooEntity = {
			id: 123,
			hoge: "fuga",
		};
		const server = new TestServer(
			(req) => {
				const pu = url.parse(req.url as string, true);
				expect("/foo/123").toEqual(pu.pathname);
				expect("?1#://").toEqual(pu.query.bar);
				return Promise.resolve<[number, any]>([200, expectedResult]);
			},
			{
				snake: true,
			},
		).listen(37446);

		const apiInfo: rc.NicoApiInfo = {
			method: "GET",
			url: "http://localhost:37446/foo/:fooId?bar=:barCond",
		};
		const method = new rc.Method<FooEntity>(apiInfo);

		method
			.exec({
				fooId: 123,
				barCond: "?1#://",
			})
			.then((data) => {
				expect(200).toEqual(data.meta.status);
				expect("OK").toEqual(data.meta.errorCode);
				expect(expectedResult).toEqual(data.data);
			})
			.then(() => {
				expect(true).toEqual(server.isCalled());
				server.close();
				cb();
			})
			.catch((error) =>
				setImmediate(() => {
					throw error;
				}),
			);
	});

	describe("Method", () => {
		it("test-call-get-with-options", (cb) => {
			const expectedResult: FooEntity = {
				id: 123,
				hoge: "fuga",
			};
			const server = new TestServer((req) => {
				const pu = url.parse(req.url as string, true);
				expect("/foo/123").toEqual(pu.pathname);
				expect("?1#://").toEqual(pu.query.bar);
				return Promise.resolve<[number, any]>([200, expectedResult]);
			}).listen(37447);

			const apiInfo: rc.NicoApiInfo = {
				method: "GET",
				url: "http://localhost:37447/foo/:fooId?bar=:barCond",
			};
			const method = new rc.Method<FooEntity>(apiInfo, (body) => body, {
				useStatusFromHeader: true,
			});

			method
				.exec({
					fooId: 123,
					barCond: "?1#://",
				})
				.then((data) => {
					expect(200).toEqual(data.meta.status);
					expect("OK").toEqual(data.meta.errorCode);
					expect(expectedResult).toEqual(data.data);
				})
				.then(() => {
					expect(true).toEqual(server.isCalled());
					server.close();
					cb();
				})
				.catch((error) =>
					setImmediate(() => {
						throw error;
					}),
				);
		});
	});

	describe("Method", () => {
		it("test-call-get-with-options-timeout-ok", (cb) => {
			const expectedResult: FooEntity = {
				id: 123,
				hoge: "fuga",
			};
			const server = new TestServer((req) => {
				const pu = url.parse(req.url as string, true);
				expect("/foo/123").toEqual(pu.pathname);
				expect("?1#://").toEqual(pu.query.bar);
				return new Promise<[number, any]>((resolve) => {
					setTimeout(() => {
						resolve([200, expectedResult]);
					}, 1000);
				});
			}).listen(37455);

			const apiInfo: rc.NicoApiInfo = {
				method: "GET",
				url: "http://localhost:37455/foo/:fooId?bar=:barCond",
			};
			const timeoutMSec = 20000;
			const method = new rc.Method<FooEntity>(apiInfo, (body) => body, {
				timeout: timeoutMSec,
			});

			method
				.exec({
					fooId: 123,
					barCond: "?1#://",
				})
				.then((data) => {
					expect(200).toEqual(data.meta.status);
					expect("OK").toEqual(data.meta.errorCode);
					expect(expectedResult).toEqual(data.data);
				})
				.then(() => {
					expect(true).toEqual(server.isCalled());
					server.close();
					cb();
				})
				.catch((error) =>
					setImmediate(() => {
						throw error;
					}),
				);
		});
	});

	describe("Method", () => {
		it("test-call-get-with-options-timeout-ng", (cb) => {
			const expectedResult: FooEntity = {
				id: 123,
				hoge: "fuga",
			};
			const server = new TestServer((req) => {
				const pu = url.parse(req.url as string, true);
				expect("/foo/123").toEqual(pu.pathname);
				expect("?1#://").toEqual(pu.query.bar);
				return new Promise<[number, any]>((resolve) => {
					setTimeout(() => {
						resolve([200, expectedResult]);
					}, 1000);
				});
			}).listen(37456);

			const apiInfo: rc.NicoApiInfo = {
				method: "GET",
				url: "http://localhost:37456/foo/:fooId?bar=:barCond",
			};
			const timeoutMSec = 200;
			const method = new rc.Method<FooEntity>(apiInfo, (body) => body, {
				timeout: timeoutMSec,
			});

			method
				.exec({
					fooId: 123,
					barCond: "?1#://",
				})
				.then(() => {
					fail();
				})
				.catch((err) => {
					expect("Error").toEqual(err.name);
					expect(`Timeout of ${timeoutMSec}ms exceeded`).toEqual(err.message);
				})
				.then(() => {
					expect(false).toEqual(server.isCalled());
					server.close();
					cb();
				})
				.catch((error) =>
					setImmediate(() => {
						throw error;
					}),
				);
		});
	});

	it("test-call-post", (cb) => {
		const expectedData = {
			gyakuten: "splatoon",
		};
		const expectedResult: FooEntity = {
			id: 123,
			hoge: "fuga",
		};
		const server = new TestServer((req) => {
			const pu = url.parse(req.url as string, true);
			expect("/foo/123").toEqual(pu.pathname);
			expect("?1#://").toEqual(pu.query.bar);
			let data = "";
			req.on("data", (chunk: Buffer) => (data += chunk.toString()));
			return new Promise<[number, any]>((resolve, _reject) => {
				req.on("end", () => {
					expect(expectedData).toEqual(JSON.parse(data));
					resolve([200, expectedResult]);
				});
			}).catch((error) =>
				setImmediate(() => {
					throw error;
				}),
			);
		}).listen(37448);

		const apiInfo: rc.NicoApiInfo = {
			method: "POST",
			url: "http://localhost:37448/foo/:fooId?bar=:barCond",
		};
		const method = new rc.Method<FooEntity>(apiInfo);

		method
			.exec(
				{
					fooId: 123,
					barCond: "?1#://",
				},
				expectedData,
			)
			.then((data) => {
				expect(200).toEqual(data.meta.status);
				expect("OK").toEqual(data.meta.errorCode);
				expect(expectedResult).toEqual(data.data);
			})
			.then(() => {
				expect(true).toEqual(server.isCalled());
				server.close();
				cb();
			})
			.catch((error) =>
				setImmediate(() => {
					throw error;
				}),
			);
	});

	it("test-call-post-with-header", (cb) => {
		const expectedData = {
			gyakuten: "splatoon",
		};
		const expectedResult: FooEntity = {
			id: 123,
			hoge: "fuga",
		};
		const server = new TestServer((req) => {
			const pu = url.parse(req.url as string, true);
			expect("/foo/123").toEqual(pu.pathname);
			expect("?1#://").toEqual(pu.query.bar);
			expect("example.com").toEqual(req.headers.host);
			let data = "";
			req.on("data", (chunk: Buffer) => (data += chunk.toString()));
			return new Promise<[number, any]>((resolve, _reject) => {
				req.on("end", () => {
					expect(expectedData).toEqual(JSON.parse(data));
					resolve([200, expectedResult]);
				});
			}).catch((error) =>
				setImmediate(() => {
					throw error;
				}),
			);
		}).listen(37449);

		const apiInfo: rc.NicoApiInfo = {
			method: "POST",
			url: "http://localhost:37449/foo/:fooId?bar=:barCond",
		};
		const method = new rc.Method<FooEntity>(apiInfo);

		method
			.exec(
				{
					fooId: 123,
					barCond: "?1#://",
				},
				expectedData,
				{
					host: "example.com",
				},
			)
			.then((data) => {
				expect(200).toEqual(data.meta.status);
				expect("OK").toEqual(data.meta.errorCode);
				expect(expectedResult).toEqual(data.data);
			})
			.then(() => {
				expect(true).toEqual(server.isCalled());
				server.close();
				cb();
			})
			.catch((error) =>
				setImmediate(() => {
					throw error;
				}),
			);
	});

	it("test-call-bad-response1", (cb) => {
		const server = http
			.createServer((_req, res) => {
				res.end();
			})
			.listen(37450);

		const apiInfo: rc.NicoApiInfo = {
			method: "GET",
			url: "http://localhost:37450/foo/:fooId?bar=:barCond",
		};
		const method = new rc.Method<FooEntity>(apiInfo);

		method
			.exec({
				fooId: 123,
				barCond: "?1#://",
			})
			.then((_data) => {
				fail();
			})
			.catch((err) => {
				expect("RestClientError").toBe(err.name);
				expect(err.message).toMatch(/Parse Error.*/);
				expect("responseにmeta/statusがありません").toEqual(err.details);
				expect(rc.Errors.ErrorType.ParseError).toEqual(err.type);
				expect(rc.Errors.isRestClientError(err)).toBeTruthy();
				expect(rc.Errors.isNotFound(err)).toBeFalsy();
				expect(rc.Errors.isConflict(err)).toBeFalsy();
			})
			.then(() => {
				server.close();
				cb();
			})
			.catch((error) =>
				setImmediate(() => {
					throw error;
				}),
			);
	});

	it("test-call-bad-response2", (cb) => {
		const server = http
			.createServer((_req, res) => {
				res.writeHead(200, "OK", { "Content-Type": "application/json" });
				res.end(
					JSON.stringify({
						meta: {
							status: [200],
						},
					}),
				);
			})
			.listen(37451);

		const apiInfo: rc.NicoApiInfo = {
			method: "GET",
			url: "http://localhost:37451/foo/:fooId?bar=:barCond",
		};
		const method = new rc.Method<FooEntity>(apiInfo);

		method
			.exec({
				fooId: 123,
				barCond: "?1#://",
			})
			.then((_data) => {
				fail();
			})
			.catch((err) => {
				expect("RestClientError").toEqual(err.name);
				expect("Parse Error").toEqual(err.message);
				expect("statusが数値で無いか範囲外です").toEqual(err.details);
				expect(rc.Errors.ErrorType.ParseError).toEqual(err.type);
				expect(rc.Errors.isRestClientError(err)).toBeTruthy();
				expect(rc.Errors.isNotFound(err)).toBeFalsy();
				expect(rc.Errors.isConflict(err)).toBeFalsy();
			})
			.then(() => {
				server.close();
				cb();
			})
			.catch((error) =>
				setImmediate(() => {
					throw error;
				}),
			);
	});

	it("test-call-bad-response4", (cb) => {
		const server = net
			.createServer((c) => {
				c.write("badResponse");
				c.end();
			})
			.listen(37462);

		const apiInfo: rc.NicoApiInfo = {
			method: "GET",
			url: "http://localhost:37462/foo/:fooId?bar=:barCond",
		};
		const method = new rc.Method<FooEntity>(apiInfo);

		method
			.exec({
				fooId: 123,
				barCond: "?1#://",
			})
			.then((_data) => {
				fail();
			})
			.catch((err) => {
				expect("Error").toEqual(err.name);
				expect(err.message).toMatch(/Parse Error.*/);
				expect(undefined).toEqual(err.details);
				expect(rc.Errors.isRestClientError(err)).toBeFalsy();
				expect(rc.Errors.isNotFound(err)).toBeFalsy();
				expect(rc.Errors.isConflict(err)).toBeFalsy();
			})
			.then(() => {
				server.close();
				cb();
			})
			.catch((error) =>
				setImmediate(() => {
					throw error;
				}),
			);
	});

	it("test-call-bad-response5", (cb) => {
		const server = new TestServer((_req) => {
			return Promise.resolve<[number, any]>([200, "badResponse"]);
		}).listen(37453);

		const apiInfo: rc.NicoApiInfo = {
			method: "GET",
			url: "http://localhost:37453/foo/:fooId?bar=:barCond",
		};
		const method = new rc.Method<FooEntity>(apiInfo, (_data) => {
			throw new TypeError("test");
		});

		method
			.exec({
				fooId: 123,
				barCond: "?1#://",
			})
			.then((_data) => {
				fail();
			})
			.catch((err) => {
				expect("RestClientError").toEqual(err.name);
				expect(err.message).toMatch(/^Parse Error - \[internal error\].*/);
				expect("response.dataのパースに失敗しました").toEqual(err.details);
				expect(err.internalError).toBeTruthy();
				expect(rc.Errors.isRestClientError(err)).toBeTruthy();
				expect(rc.Errors.isNotFound(err)).toBeFalsy();
				expect(rc.Errors.isConflict(err)).toBeFalsy();
			})
			.then(() => {
				expect(true).toEqual(server.isCalled());
				server.close();
				cb();
			})
			.catch((error) =>
				setImmediate(() => {
					throw error;
				}),
			);
	});

	it("test-call-httperror", (cb) => {
		const expectedResult: FooEntity = {
			id: 123,
			hoge: "fuga",
		};
		const server = new TestServer((req) => {
			const pu = url.parse(req.url as string, true);
			expect("/foo/123").toEqual(pu.pathname);
			expect("?1#://").toEqual(pu.query.bar);
			return Promise.resolve<[number, any]>([404, expectedResult]);
		}).listen(37454);

		const apiInfo: rc.NicoApiInfo = {
			method: "GET",
			url: "http://localhost:37454/foo/:fooId?bar=:barCond",
		};
		const method = new rc.Method<FooEntity>(apiInfo);

		method
			.exec({
				fooId: 123,
				barCond: "?1#://",
			})
			.then((_data) => fail())
			.catch((err) => {
				expect("RestClientError").toEqual(err.name);
				expect("NOT_FOUND").toEqual(err.message);
				expect('HTTPエラー: 404 NOT_FOUND "testServer"').toEqual(err.details);
				expect(rc.Errors.ErrorType.HTTPError).toEqual(err.type);
				expect(404).toEqual(err.body.meta.status);
				expect("NOT_FOUND").toEqual(err.body.meta.errorCode);
				expect(expectedResult).toEqual(err.body.data);
				expect(rc.Errors.isRestClientError(err)).toBeTruthy();
				expect(rc.Errors.isNotFound(err)).toBeTruthy();
				expect(rc.Errors.isConflict(err)).toBeFalsy();
			})
			.then(() => {
				expect(true).toEqual(server.isCalled());
				server.close();
				cb();
			})
			.catch((error) =>
				setImmediate(() => {
					throw error;
				}),
			);
	});
});
