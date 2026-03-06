import { SystemApiClient } from "@akashic/system-api-client";

import config from "config";
import url from "url";

function getEndpoint(): string {
	return config.get("endpoints.system-api-server");
}

// 親プレーのトークンで子プレーも認証できる という機能の文脈で出てくる play children。
describe("play children API", () => {
	test("happy path", async () => {
		const gameCode: string = "game_code_usage_0";
		const userID: string = "akashic-bot";
		const client = new SystemApiClient(getEndpoint());

		// play を作る
		const resultCreatedPlay = await client.createPlay(gameCode);
		expect(resultCreatedPlay.meta.status).toBe(200);
		expect(resultCreatedPlay.data!.status).toBe("running");
		// readTick 以外の権限は、対象の Play の status が running である必要があります。

		const playID = resultCreatedPlay.data!.id;

		// トークン発行
		const resultGotToken = await client.createPlayToken(playID, userID, {
			readTick: true,
			writeTick: true,
			subscribeTick: true,
			sendEvent: true,
			subscribeEvent: true,
			maxEventPriority: 1,
		});
		expect(resultGotToken.meta.status).toBe(200);

		const playToken: string = resultGotToken.data!.value;
		const playlogServerEndpoint: string = resultGotToken.data!.url;
		expect(playToken.length).toBeGreaterThan(1); // 空文字とかじゃなければ OK ってことで。
		const playlogServerEndpointParsed = url.parse(playlogServerEndpoint);
		expect(playlogServerEndpointParsed.protocol).toBe("ws:"); // さすがにテストする環境で over SSL はないでしょうから。

		// 同一の playID に対する2回目の writeTick や sendEvent 権限のあるトークン発行
		const resultGotToken2 = await client.createPlayToken(playID, userID, {
			readTick: true,
			writeTick: true,
			subscribeTick: true,
			sendEvent: true,
			subscribeEvent: true,
			maxEventPriority: 1,
		});
		expect(resultGotToken2.meta.status).toBe(200);

		// ゲームインスタンスを作る
		// どうやってつくるのが良いかわからん
		const resultCreatedInstance = await client.createInstance(
			gameCode,
			[
				{
					code: "dynamicPlaylogWorker",
					values: {
						playId: playID,
						executionMode: "active",
					},
				},
			],
			1,
			"engines/akashic/v2.0/entry.js",
		);
		// たぶん、instance の status みたいなのも expect したほうがいいと思う
		expect(resultCreatedInstance.meta.status).toBe(200);

		// playlog-client を作って、つないでみる
		// playlog セッションを閉じる

		// game instance を終わらす
		const instanceID = resultCreatedInstance.data?.id;
		const resultDeletedInstance = await client.deleteInstance(instanceID || "");
		expect(resultDeletedInstance.meta.status).toBe(200);

		// play を止める
		const resultDeletedPlay = await client.deletePlay(playID);
		expect(resultDeletedPlay.meta.status).toBe(200);
		expect(resultDeletedPlay.data!.status).toBe("suspending");

		// 終了したplayに対して読み取り権限のみを持つトークン発行
		const resultGotDeletedPlayToken = await client.createPlayToken(playID, userID, {
			readTick: true,
			writeTick: false,
			subscribeTick: false,
			sendEvent: false,
			subscribeEvent: false,
			maxEventPriority: 1,
		});
		expect(resultGotDeletedPlayToken.meta.status).toBe(200);
	});
});
