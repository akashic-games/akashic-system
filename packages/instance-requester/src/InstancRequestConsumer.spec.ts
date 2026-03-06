import { AmqpConnectionManager } from "@akashic/amqp-utils";
import { InstanceRequestConsumer } from "./";

describe("InstanceRequestConsumer", () => {
	it("can construct", (done) => {
		const mgr = new AmqpConnectionManager({ urls: "amqp://user:password@localhost" });
		const consumer = new InstanceRequestConsumer(mgr, () => {
			return true;
		});
		consumer
			.start()
			// start() は接続 (mgr.init()) 前なので、エラーになる
			.then(() => done.fail("operation not failed"))
			.catch(() => consumer.stop())
			// stop() は成功する
			.then(done)
			.catch(done.fail);
	});
});
