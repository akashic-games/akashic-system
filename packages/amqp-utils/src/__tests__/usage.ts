import * as amqp from "amqplib";
import config from "config";
import { AmqpChannelHolder, AmqpConnection, AmqpConnectionManager } from "../";

function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

test("AmqpConnectionManager basic usage", async () => {
	const manager = new AmqpConnectionManager({
		urls: config.get<string[]>("rabbitmq.url"), // 設定ファイルでは単数形で定義される
		user: config.get<string>("rabbitmq.user"),
		// ファイルで passwd なのは、RabbitMQ の公式のツールでそうなっていることに由来する
		password: config.get<string>("rabbitmq.passwd"),
	});

	// 1つ以上のサーバに繋がり次第、resolve される
	await manager.init();

	// チャンネルの作成をして、渡された処理をする例
	// 例外が発生しても、別のサーバでチャンネルを再生してリトライする。
	// 処理が完了したら、チャンネルは勝手に閉じる。
	await manager.doChannelTask(async (ch: amqp.Channel) => {
		// AMQP の基礎基本だけれど、最初に初期化として Queue と Exchange を作るので、その例。
		await ch.assertExchange("test_exchange", "fanout", { durable: false });
		await ch.assertQueue("test_queue", { durable: false });
		await ch.bindQueue("test_queue", "test_exchange", "test_key");
	});

	const testMessage = Buffer.from("test_message");

	// consumer 側の例
	// consume などの、 channel を対象に取る例
	const channel = new AmqpChannelHolder(manager);
	// channel が生成された（コネクションが張られた）ら、 connect が emit される
	const connectPromise = new Promise<void>((resolve, reject) => {
		channel.on("connect", async () => {
			// channel 生成後なので、ガードできる
			// なので、もし throw Error するなら、Logic Exception 。
			const channelRaw = channel.channel;
			if (channelRaw == null) {
				reject("channel.channel is null. may be connection error or timing issue on connecting amqp server.");
				return;
			}

			// 無難に、consume する例
			await channelRaw.consume("test_queue", (msg) => {
				if (msg == null) {
					reject("msg is null.");
					return;
				}
				expect(msg.content.toString()).toBe(testMessage.toString());
				// 処理後にきちんと ACK/NACK を返すのが AMQP の作法
				channelRaw.ack(msg);
				resolve();
			});
		});
		// 設定したら、忘れずに start する
		channel.start(); // ただし、内部では投げっぱなしなので、時間かかるかもしれない。
	});

	// producer 側の例
	await manager.publish("test_exchange", "test_key", testMessage);

	await connectPromise;
	// おわり
	await channel.stop();
	await manager.close();
});

describe("AmqpConnectionManager events", () => {
	test("connect", (done) => {
		const manager = new AmqpConnectionManager({
			urls: config.get<string[]>("rabbitmq.url"), // 設定ファイルでは単数形で定義される
			user: config.get<string>("rabbitmq.user"),
			// ファイルで passwd なのは、RabbitMQ の公式のツールでそうなっていることに由来する
			password: config.get<string>("rabbitmq.passwd"),
		});
		manager.on("connect", (connection: AmqpConnection) => {
			expect(connection.connection).not.toBeNull();
			done();
			manager.close();
		});

		manager.init().catch((err) => done.fail(err)); // connect される
	});

	test("close", async () => {
		const manager = new AmqpConnectionManager({
			urls: config.get<string[]>("rabbitmq.url"), // 設定ファイルでは単数形で定義される
			user: config.get<string>("rabbitmq.user"),
			// ファイルで passwd なのは、RabbitMQ の公式のツールでそうなっていることに由来する
			password: config.get<string>("rabbitmq.passwd"),
		});
		const closePromise = new Promise<void>((resolve) => {
			manager.on("close", (connection: AmqpConnection) => {
				// close されたあとに emit されるので、Connection は取れない。
				expect(connection.connection).toBeNull();
				resolve();
			});
		});

		await manager.init();
		await manager.close();
		await closePromise;
	});

	// AmqpConnectionManager.doChannelTask の実行中にエラーになると Emit される
	test.todo("channelError");
});

test("AmqpConnectionManager should return rejected promise when AMQP server is NOT available", async () => {
	// 1,000 ミリ秒以内につながらなかったら、 reject されてくる。
	await expect(new AmqpConnectionManager({ urls: "not-exists.host.url" }).init(1000)).rejects.toThrow();
});

test("AmqpChannelHolder can use channel after start", async () => {
	const manager = new AmqpConnectionManager({
		urls: config.get<string[]>("rabbitmq.url"), // 設定ファイルでは単数形で定義される
		user: config.get<string>("rabbitmq.user"),
		// ファイルで passwd なのは、RabbitMQ の公式のツールでそうなっていることに由来する
		password: config.get<string>("rabbitmq.passwd"),
	});
	await manager.init();
	// チャンネル作成して接続してみる
	const holder = new AmqpChannelHolder(manager);
	await new Promise((resolve) => {
		holder.once("connect", resolve);
		holder.start();
	});
	expect(holder.channel).not.toBeNull();
	// 無効なキューをconsumeしてもnullにならないのを確認
	const channel = holder.channel!;
	// tslint:disable-next-line no-empty
	await expect(channel.consume("invalid-queue-name", () => {})).rejects.toThrow();
	await wait(100);
	await holder.getChannel();
	expect(holder.channel).not.toBeNull();
	// その後正しく閉じれるか確認
	await holder.stop();
});

test("AmqpChannelHolder can use getChannel without start", async () => {
	const manager = new AmqpConnectionManager({
		urls: config.get<string[]>("rabbitmq.url"), // 設定ファイルでは単数形で定義される
		user: config.get<string>("rabbitmq.user"),
		// ファイルで passwd なのは、RabbitMQ の公式のツールでそうなっていることに由来する
		password: config.get<string>("rabbitmq.passwd"),
	});
	await manager.init();
	// getChannelで自動接続されることを確認
	const holder = new AmqpChannelHolder(manager);
	let channel = await holder.getChannel();
	expect(channel).not.toBeNull();
	// 無効なキューをconsumeしてもnullにならないのを確認
	// tslint:disable-next-line no-empty
	await expect(channel.consume("invalid-queue-name", () => {})).rejects.toThrow();
	await wait(100);
	await holder.getChannel();
	channel = await holder.getChannel();
	expect(channel).not.toBeNull();
	// その後正しく閉じれるか確認
	await holder.stop();
});

test("duplicate getChannel return same channel", async () => {
	const manager = new AmqpConnectionManager({
		urls: config.get<string[]>("rabbitmq.url"), // 設定ファイルでは単数形で定義される
		user: config.get<string>("rabbitmq.user"),
		// ファイルで passwd なのは、RabbitMQ の公式のツールでそうなっていることに由来する
		password: config.get<string>("rabbitmq.passwd"),
	});
	await manager.init();
	const holder = new AmqpChannelHolder(manager);
	// getChannel同時呼びでも同じchannelを返す
	const [channel1, channel2] = await Promise.all([holder.getChannel(), holder.getChannel()]);
	expect(channel2).toBe(channel1);
	// 後でもう一度読んでも同じchannelを返す
	const channel3 = await holder.getChannel();
	expect(channel3).toBe(channel1);
	// その後正しく閉じれるか確認
	await holder.stop();
});

test("reconnect channel return different channel", async () => {
	const manager = new AmqpConnectionManager({
		urls: config.get<string[]>("rabbitmq.url"), // 設定ファイルでは単数形で定義される
		user: config.get<string>("rabbitmq.user"),
		// ファイルで passwd なのは、RabbitMQ の公式のツールでそうなっていることに由来する
		password: config.get<string>("rabbitmq.passwd"),
	});
	await manager.init();
	const holder = new AmqpChannelHolder(manager);
	const channel1: amqp.Channel = await holder.getChannel();
	await holder.stop();
	const channel2: amqp.Channel = await holder.getChannel();
	expect(channel2).not.toBe(channel1);
});

test("pubsub test", async () => {
	// 2つ分のコネクションとチャンネル作成
	const manager1 = new AmqpConnectionManager({
		urls: config.get<string[]>("rabbitmq.url"), // 設定ファイルでは単数形で定義される
		user: config.get<string>("rabbitmq.user"),
		// ファイルで passwd なのは、RabbitMQ の公式のツールでそうなっていることに由来する
		password: config.get<string>("rabbitmq.passwd"),
	});
	const manager2 = new AmqpConnectionManager({
		urls: config.get<string[]>("rabbitmq.url"), // 設定ファイルでは単数形で定義される
		user: config.get<string>("rabbitmq.user"),
		// ファイルで passwd なのは、RabbitMQ の公式のツールでそうなっていることに由来する
		password: config.get<string>("rabbitmq.passwd"),
	});
	await manager1.init();
	await manager2.init();
	const holder1 = new AmqpChannelHolder(manager1);
	const channel1: amqp.Channel = await holder1.getChannel();
	const holder2 = new AmqpChannelHolder(manager2);
	const channel2: amqp.Channel = await holder2.getChannel();
	// subscribeする。1が受けで2が送信
	const spy = jest.fn();
	await channel2.assertExchange("pubsub-test", "fanout", { autoDelete: true });
	await channel1.assertQueue("pubsub-test-queue", { exclusive: true, autoDelete: true });
	await channel1.bindQueue("pubsub-test-queue", "pubsub-test", "");
	await channel1.consume("pubsub-test-queue", () => spy());
	holder1.on("reconnected", async () => {
		// エラー時でも再講読する
		const ch = await holder1.getChannel();
		expect(ch).not.toBe(channel1);
		// exchangeも作り直しているが、どうも同じプロセスからだと違うチャンネルであっても消えてしまうらしい。現実的には同じプロセスからpub/sub両方することは無いので無視
		await ch.assertExchange("pubsub-test", "fanout", { autoDelete: true });
		await ch.assertQueue("pubsub-test-queue", { exclusive: true, autoDelete: true });
		await ch.bindQueue("pubsub-test-queue", "pubsub-test", "");
		await ch.consume("pubsub-test-queue", () => spy());
	});
	channel2.publish("pubsub-test", "", Buffer.from("test", "utf-8"));
	await wait(100);
	expect(spy.mock.calls.length).toBe(1);
	// エラーを引き起こしてChannelHolderに再接続させる
	// tslint:disable-next-line
	await expect(channel1.consume("invalid-queue-name", () => {})).rejects.toThrow();
	await wait(1000);
	// もう一度送信すると、spy()が呼ばれる
	channel2.publish("pubsub-test", "", Buffer.from("test", "utf-8"));
	await wait(100);
	// 再接続分も呼ばれているはず
	expect(spy.mock.calls.length).toBe(2);
});

test("AmqpConnectionManager#initを呼び忘れた状態でAmqpChannelHolder#getChannel()を呼ぶとエラーが返ってくる", async () => {
	const manager = new AmqpConnectionManager({
		urls: config.get<string[]>("rabbitmq.url"), // 設定ファイルでは単数形で定義される
		user: config.get<string>("rabbitmq.user"),
		// ファイルで passwd なのは、RabbitMQ の公式のツールでそうなっていることに由来する
		password: config.get<string>("rabbitmq.passwd"),
	});
	const holder = new AmqpChannelHolder(manager);
	await expect(holder.getChannel()).rejects.toThrowError("no amqp connection available");
});
