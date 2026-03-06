import { SystemApiClient } from "@akashic/system-api-client";
import { createPool } from "mysql";
import { Errors } from "@akashic/rest-client-core";

import config from "config";

function getEndpoint(): string {
	return config.get("endpoints.system-api-server");
}

describe("play API", () => {
	test("happy path", async () => {
		const gameCode: string = "game_code_0";

		// 作る
		const client = new SystemApiClient(getEndpoint());
		const resultCreated = await client.createPlay(gameCode);
		expect(resultCreated.meta.status).toBe(200);
		expect(resultCreated.data!.gameCode).toBe(gameCode);
		expect(resultCreated.data!.status).toBe("running");

		const playID: string = resultCreated.data!.id;

		// 作ったやつを取得
		const resultGot = await client.getPlay(playID);
		expect(resultGot.meta.status).toBe(200);
		expect(resultGot.data!.gameCode).toBe(resultCreated.data!.gameCode);
		expect(resultGot.data!.status).toBe(resultCreated.data!.status);
		expect(resultGot.data!.id).toBe(playID);

		// 作ったやつを検索で見つけてくる
		const resultFound = await client.findPlays({ gameCode: gameCode, order: "d" });
		expect(resultFound.meta.status).toBe(200);
		expect(resultFound.data!.totalCount).toBe(undefined);
		expect(resultFound.data!.values.length).toBeGreaterThanOrEqual(1);
		expect(resultFound.data!.values[0].id).toBe(playID);
		// 件数もほしい場合（この機能、何に使うんだ）
		const resultFound1 = await client.findPlays({ gameCode: gameCode, _count: 1, order: "d" });
		expect(resultFound1.meta.status).toBe(200);
		// expect(resultFound1.data!.totalCount).toBeGreaterThanOrEqual(1);
		expect(resultFound1.data!.values[0].id).toBe(playID);

		// running 状態なやつを start させようとしたら、 HTTP CONFLICT の Rest Client Error がthrow される
		const resultStarted: Errors.RestClientError = await client.startPlay(playID).catch((result) => result);
		expect(resultStarted.body!.meta.status).toBe(409);
		expect(resultStarted.body!.meta.errorCode).toBe("CONFLICT");

		// 止める
		const resultStopped = await client.stopPlay(playID);
		expect(resultStopped.meta.status).toBe(200);
		expect(resultStopped.data!.status).toBe("suspending");

		// 止めたから、止めた状態になってる
		const resultGot1 = await client.getPlay(playID);
		expect(resultGot1.meta.status).toBe(200);
		expect(resultGot1.data!.status).toBe("suspending");

		// 止めた状態のやつを止めようとしたら、HTTP CONFLICT の RestClientError が throw されてくる
		const resultStopped1: Errors.RestClientError = await client.stopPlay(playID).catch((reason) => reason);
		expect(resultStopped1.body!.meta.status).toBe(409);
		expect(resultStopped1.body!.meta.errorCode).toBe("CONFLICT");

		// 再開
		const resultRestarted = await client.startPlay(playID);
		expect(resultRestarted.meta.status).toBe(200);
		expect(resultRestarted.data!.status).toBe("running");
	});

	test("if get not exist play, GET play returns NOT FOUND HTTP status", async () => {
		const client = new SystemApiClient(getEndpoint());

		try {
			// おそらく存在しないであろう Play
			await client.getPlay("999123456789");

			// throw されるので、ここまで到達品
			fail("haven't thrown error");
		} catch (e) {
			expect((e as any).body.meta.status).toBe(404);
		}
	});

	test("if get not exist play, FIND play returns empty value, not NOT FOUND HTTP status", async () => {
		const client = new SystemApiClient(getEndpoint());

		// おそらく存在しないであろう Game Code
		const resultFound = await client.findPlays({ gameCode: "999123456789" });
		expect(resultFound.meta.status).toBe(200);
		expect(resultFound.data!.totalCount).toBe(undefined); // _count を指定していないため
		expect(resultFound.data!.values.length).toBe(0);

		// おそらく存在しないであろう Game Code
		const resultFound1 = await client.findPlays({ gameCode: "999123456789", _count: 1 });
		expect(resultFound1.meta.status).toBe(200);
		// expect(resultFound1.data!.totalCount).toBe(0); // _count を指定したので
		expect(resultFound1.data!.values.length).toBe(0);
	});

	test("nicolive metadata", async () => {
		const client = new SystemApiClient(getEndpoint());
		const pool = createPool(config.get("dbSettings.database"));

		const gameCode: string = "game_code_0";
		// ニコ生メタ情報
		const nicoliveMetadata = {
			programId: "lv123",
			onAirTime: "2022-02-14 00:00:00",
			providerId: "12345",
			providerType: "official",
			broadcasterId: "25562",
			broadcasterName: "test",
			hasLinkedContent: true,
			tags: ["test"],
		};
		const parameters = {
			gameCode,
			nicoliveMetadata,
		};

		const resultCreated = await client.createPlay(parameters);
		expect(resultCreated.meta.status).toBe(200);
		expect(resultCreated.data!.gameCode).toBe(gameCode);
		expect(resultCreated.data!.status).toBe("running");

		const playID: string = resultCreated.data!.id;

		// 200ms待つ
		await new Promise((resolve) => setTimeout(resolve, 200));
		// providerTypeをチェックする
		const sqlString = `select * from playsNicoliveMetadata where playId="${playID}"`;
		const providerTypeColumn = await new Promise((resolve, reject) =>
			pool.query(sqlString, (err, results) => (err ? reject(err) : resolve(results[0]?.providerType))),
		);
		expect(providerTypeColumn).toBe("official");

		// 止める
		const resultStopped = await client.stopPlay(playID);
		expect(resultStopped.meta.status).toBe(200);
		expect(resultStopped.data!.status).toBe("suspending");

		pool.end();
	});
});
