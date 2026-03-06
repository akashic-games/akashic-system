import { AmqpConnectionManager } from "./";

describe("AmqpConnectionManager", () => {
	it("can construct", () => {
		const mgr = new AmqpConnectionManager({
			urls: ["amqp://server1", "amqp://server2", "amqp://server3"],
			user: "user",
			password: "password",
		});
		// init 前なので connection は取れない
		expect(() => {
			mgr.getConnection();
		}).toThrow();
		expect(() => {
			mgr.close();
		}).not.toThrow();
	});
});
