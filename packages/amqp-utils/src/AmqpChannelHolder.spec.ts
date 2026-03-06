import { AmqpChannelHolder, AmqpConnectionManager } from "./";

describe("AmqpChannelHolder", () => {
	it("can construct", () => {
		const mgr = new AmqpConnectionManager({
			urls: ["amqp://server1", "amqp://server2", "amqp://server3"],
			user: "user",
			password: "password",
		});
		const channelHolder = new AmqpChannelHolder(mgr);
		expect(channelHolder.channel).toBeNull();
		expect(() => {
			channelHolder.stop();
		}).not.toThrow();
	});
});
