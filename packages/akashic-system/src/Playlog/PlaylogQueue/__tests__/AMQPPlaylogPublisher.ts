import "jest";
import config from "config";
import { AmqpChannelHolder, AmqpConnectionManager } from "@akashic/amqp-utils";
import { AMQPPlaylogPublisher } from "../AMQPPlaylogPublisher";
import { AMQPPlaylogQueue } from "../AMQPPlaylogQueue";
import { EVENT_MAX_PRIORITY } from "../constants";
import type { Event } from "@akashic/playlog";

function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("AMQPPlaylogPublisherのテスト", () => {
	const playId = "2345432";
	const normalEvent: Event = [1, 0, null];
	const maxPriorityEvent: Event = [1, EVENT_MAX_PRIORITY, null];

	it("通常のイベントも、max priorityなイベントもpublishEventで問題なくpublishできる", async () => {
		// コネクション準備
		const amqpManager = new AmqpConnectionManager({
			urls: config.get("rabbitmq.url"),
		});
		await amqpManager.init();
		const amqpChannel = new AmqpChannelHolder(amqpManager);
		// publisherとキューの準備
		const publisher = new AMQPPlaylogPublisher(amqpChannel);
		await publisher.start();
		await publisher.prepare(playId);
		const queue = new AMQPPlaylogQueue(amqpChannel);
		await queue.start();

		const queueCallback = {
			onEventMessage: jest.fn().mockResolvedValue(undefined),
			onTickMessage: jest.fn().mockResolvedValue(undefined),
		};
		queue.subscribe(playId, queueCallback);
		// publish
		await publisher.publishEvent(playId, normalEvent);
		await publisher.publishEvent(playId, maxPriorityEvent);
		// AMQPを待つ
		await wait(200);
		// 呼ばれた回数チェック
		expect(queueCallback.onEventMessage.mock.calls.length).toBe(2);

		// クリーンアップ
		await publisher.cleanup(playId);
		await publisher.stop();
		await queue.stop();
		await amqpChannel.stop();
		await amqpManager.close();
	});
});
