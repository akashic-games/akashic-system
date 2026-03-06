import { AmqpConnectionManager } from "@akashic/amqp-utils";
import { InstanceRequestPublisher } from "./";

describe("InstanceRequestPublisher", () => {
	it("can construct", async () => {
		const mgr = new AmqpConnectionManager({ urls: "amqp://user:password@localhost" });
		const publisher = new InstanceRequestPublisher(mgr);

		// 接続 (mgr.init()) 前なので、すべてエラーになる
		await expect(publisher.setup()).rejects.toThrow();

		await expect(publisher.requestStartInstance("42")).rejects.toThrow();

		await expect(publisher.requestStopInstance("42")).rejects.toThrow();
	});
});
