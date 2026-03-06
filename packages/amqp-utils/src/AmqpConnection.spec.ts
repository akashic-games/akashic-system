import config from "config";
import { AmqpConnection } from "./";

describe("AmqpConnection", () => {
	it("can construct", () => {
		const conn1 = new AmqpConnection("amqp://server1", "user", "password");
		expect(conn1.url).toBe("amqp://server1:5672/");
		expect(conn1.connection).toBeNull();
		expect(() => {
			conn1.close();
		}).not.toThrow();

		const conn2 = new AmqpConnection("amqp://user:password@server2:12345/vhost2");
		expect(conn2.url).toBe("amqp://server2:12345/vhost2");
		expect(conn2.connection).toBeNull();
		expect(() => {
			conn2.close();
		}).not.toThrow();
	});

	it("can connect", (done) => {
		const urls = config.get<string[]>("rabbitmq.url");
		const user = config.get<string>("rabbitmq.user");
		const password = config.get<string>("rabbitmq.passwd");

		const conn = new AmqpConnection(urls[0], user, password);
		conn.on("connect", () => {
			done();
		});
		conn.on("close", () => {
			done.fail("on close");
		});
		conn.on("error", () => {
			done.fail("on error");
		});

		// 接続できないと、 8回くらいリトライする頃には Jasmine がタイムアウトする。
		conn.connect();
	});
});
