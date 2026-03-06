import { SystemApiClient } from "@akashic/system-api-client";

import config from "config";

function getEndpoint(): string {
	return config.get("endpoints.system-api-server");
}

describe("token API", () => {
	test("should throw 503 with invalid trait", async () => {
		const gameCode: string = "invalid_trait_string0";
		const userID: string = "akashic-bot";
		const client = new SystemApiClient(getEndpoint());

		// play を作る
		const resultCreatedPlay = await client.createPlay(gameCode);
		expect(resultCreatedPlay.meta.status).toBe(200);
		expect(resultCreatedPlay.data!.status).toBe("running");
		// readTick 以外の権限は、対象の Play の status が running である必要があります。

		const playID = resultCreatedPlay.data!.id;

		// トークン発行
		const resultGotToken = await client
			.createPlayToken(
				playID,
				userID,
				{
					readTick: true,
					writeTick: true,
					subscribeTick: true,
					sendEvent: true,
					subscribeEvent: true,
					maxEventPriority: 1,
				},
				{
					trait: "!!invalid_trait!!",
				},
			)
			.catch((reason) => reason);
		expect(resultGotToken.body!.meta.status).toBe(503);
	});

	test("should throw 409", async () => {
		const gameCode: string = "game_code_usage_0";
		const userID: string = "akashic-bot";
		const client = new SystemApiClient(getEndpoint());
		// play を作る
		const resultCreatedPlay = await client.createPlay(gameCode);
		expect(resultCreatedPlay.meta.status).toBe(200);
		expect(resultCreatedPlay.data!.status).toBe("running");
		const playID = resultCreatedPlay.data!.id;
		// play を止める
		const resultDeletedPlay = await client.deletePlay(playID);
		expect(resultDeletedPlay.meta.status).toBe(200);
		expect(resultDeletedPlay.data!.status).toBe("suspending");

		// readTick 以外の権限は、対象の Play の status が running である必要があります。

		// 終了したplayに対して書き込み権限を持つトークン発行
		const resultPlayTokenWithWriteTick = await client
			.createPlayToken(playID, userID, {
				readTick: false,
				writeTick: true,
				subscribeTick: false,
				sendEvent: false,
				subscribeEvent: false,
				maxEventPriority: 1,
			})
			.catch((reason) => reason);
		expect(resultPlayTokenWithWriteTick.body!.meta.status).toBe(409);

		// 終了したplayに対してイベント送信権限を持つトークン発行
		const resultPlayTokenWithSendEvent = await client
			.createPlayToken(playID, userID, {
				readTick: false,
				writeTick: false,
				subscribeTick: false,
				sendEvent: true,
				subscribeEvent: false,
				maxEventPriority: 1,
			})
			.catch((reason) => reason);
		expect(resultPlayTokenWithSendEvent.body!.meta.status).toBe(409);
	});
});
