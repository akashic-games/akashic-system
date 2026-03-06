import "jest";
import { promisify } from "util";
import config from "config";
import { MongoClient } from "mongodb";
import { PlayToken, PlayTokenPermission, SystemApiClient } from "@akashic/system-api-client";
import { Session, Client } from "@akashic/playlog-client";
import { WebSocketAPI } from "../../websocket/WebSocketAPI";
import type { Tick, Event, TickList } from "@akashic/playlog";
import { AmqpChannelHolder, AmqpConnectionManager } from "@akashic/amqp-utils";
import { AMQPPlaylogPublisher, AMQPPlaylogQueue, MongoDBStore } from "@akashic/akashic-system";

// @ts-ignore
global.WebSocket = WebSocketAPI;

function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function getEndpoint(): string {
	return config.get("endpoints.system-api-server");
}

async function getToken(client: SystemApiClient, playId: string, userId: string, permission: PlayTokenPermission): Promise<PlayToken> {
	const createPlayTokenResult = await client.createPlayToken(playId, userId, permission);
	const token = createPlayTokenResult.data!;

	token.url = token.url.replace("playlog-server", "localhost");
	return token;
}

async function createClient(
	systemAPiClient: SystemApiClient,
	userId: string,
	playId: string,
	permission: PlayTokenPermission,
): Promise<[Session, Client]> {
	const token = await getToken(systemAPiClient, playId, userId, permission);
	const session = new Session(token.url, {
		validationData: {
			playId,
			token: token.value,
		},
	});
	await promisify(session.open).bind(session)();
	const playlogClient: Client = (await promisify(session.createClient).bind(session)())!;
	await promisify(playlogClient.open).bind(playlogClient)(playId);
	await promisify(playlogClient.authenticate).bind(playlogClient)(token.value);
	return [session, playlogClient];
}

async function createClientWithRetry(
	systemAPiClient: SystemApiClient,
	userId: string,
	playId: string,
	permission: PlayTokenPermission,
	retry: number,
): Promise<[Session, Client]> {
	let lastError: Error = new Error("dummy");
	for (let i = 0; i < retry; ++i) {
		// 調子悪くてリトライする必要があるかも。できれば外したいが。
		try {
			const [session, client] = await Promise.race([
				createClient(systemAPiClient, userId, playId, permission),
				new Promise<[Session, Client]>((_, reject) => setTimeout(() => reject(new Error("timeout")), 1000)),
			]);
			return [session, client];
		} catch (e) {
			lastError = e as Error;
			await wait(200);
			continue;
		}
	}
	throw lastError;
}

async function createPublisher(playId: string) {
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

	return [amqpManager, amqpChannel, publisher, queue] as const;
}

async function setTicks(playId: string, ticks: Tick[]): Promise<void> {
	const client = new MongoClient(config.get("mongodb.url"));
	await client.connect();
	const db = client.db("akashic_test");
	const store = new MongoDBStore(db);
	for (const tick of ticks) {
		await store.putTick(playId, tick);
	}
}

describe("playlog-serverにクライアントから接続できるかのテスト", () => {
	const userId: string = "akashic-bot";
	const ticks: Tick[] = [[1, [[32, 0, userId, "hoge"]]], [2], [3]];
	const events: Event[] = [[32, 0, userId, "hoge"]];

	it("PlaylogClientからtokenの認証が通る", async () => {
		const gameCode: string = "game_code_playlog_test0";
		// playを作る
		const client = new SystemApiClient(getEndpoint());
		const createPlayResult = await client.createPlay(gameCode);
		expect(createPlayResult.meta.status).toBe(200);
		const playId = createPlayResult.data!.id;
		const [session, playlogClient] = await createClientWithRetry(
			client,
			userId,
			playId,
			{
				writeTick: false,
				readTick: true,
				subscribeTick: true,
				sendEvent: true,
				subscribeEvent: false,
				maxEventPriority: 0,
			},
			5,
		);

		// クリーンアップ
		await promisify(playlogClient.close).bind(playlogClient)();
		await promisify(session.close).bind(session)();
	});

	it("ニコ生でリアルタイム再生する時のつなぎ方でのテスト", async () => {
		const gameCode: string = "game_code_playlog_test1";
		const resultTicks: Tick[] = [];
		const resultEvents: Event[] = [];
		// playを作る
		const client = new SystemApiClient(getEndpoint());
		const createPlayResult = await client.createPlay(gameCode);
		expect(createPlayResult.meta.status).toBe(200);
		const playId = createPlayResult.data!.id;
		const [session, playlogClient] = await createClientWithRetry(
			client,
			userId,
			playId,
			{
				writeTick: false,
				readTick: true,
				subscribeTick: true,
				sendEvent: true,
				subscribeEvent: false,
				maxEventPriority: 0,
			},
			5,
		);
		playlogClient.onTick((tick) => resultTicks.push(tick));
		// amqpの準備
		const [amqpManager, amqpChannel, publisher, queue] = await createPublisher(playId);
		await queue.subscribe(playId, {
			onEventMessage: async (_, event) => {
				resultEvents.push(event);
			},
		});
		// mongodbの準備
		await setTicks(playId, ticks);

		// tickのsubscribeのテスト
		await publisher.publishTick(playId, ticks[0]);
		await wait(200);
		expect(resultTicks).toEqual([ticks[0]]);

		//eventのpushのテスト
		playlogClient.sendEvent(events[0]);
		await wait(1000);
		expect(resultEvents).toEqual([events[0]]);

		// getTickListではframeだけのtickは省略される
		// 部分的に省略されて返ってくるパターン
		// getTickListのテスト
		const tickList: TickList = (await promisify(playlogClient.getTickList).bind(playlogClient)({ begin: 1, end: 2 }))!;
		expect(tickList[2]).toEqual([ticks[0]]); // 2フレーム目は省略される
		// @ts-ignore
		const tickList2: TickList = (await promisify(playlogClient.getTickList).bind(playlogClient)(1, 2))!;
		expect(tickList2[2]).toEqual([ticks[0]]); // 2フレーム目は省略される
		// 全部省略されるパターン
		// getTickListのテスト
		const tickList3: TickList = (await promisify(playlogClient.getTickList).bind(playlogClient)({ begin: 2, end: 3 }))!;
		expect(tickList3[2]).toBeFalsy(); // 全部省略した場合はfalsyになる
		// @ts-ignore
		const tickList4: TickList = (await promisify(playlogClient.getTickList).bind(playlogClient)(2, 3))!;
		expect(tickList4[2]).toBeFalsy(); // 全部省略した場合はfalsyになる

		// クリーンアップ
		await promisify(playlogClient.close).bind(playlogClient)();
		await promisify(session.close).bind(session)();
		await publisher.stop();
		await queue.stop();
		await amqpChannel.stop();
		await amqpManager.close();
	}, 60000); // リトライとかするのですみませんがテスト許可時間長めです。
});
