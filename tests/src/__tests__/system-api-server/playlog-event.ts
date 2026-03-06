import { SystemApiClient } from "@akashic/system-api-client";

import config from "config";

function getEndpoint(): string {
	return config.get("endpoints.system-api-server");
}

describe("playlog-event API", () => {
	test("basic usage", async () => {
		const gameCode: string = "playlog_event_test_string0";
		const userID: string = "akashic-bot";
		const client = new SystemApiClient(getEndpoint());

		// play を作る
		const resultCreatedPlay = await client.createPlay(gameCode);
		expect(resultCreatedPlay.meta.status).toBe(200);
		expect(resultCreatedPlay.data!.status).toBe("running");

		const playID = resultCreatedPlay.data!.id;
		const resultJoinEvent = await client.createPlaylogEvent(playID, {
			type: "JoinPlayer",
			values: {
				userId: userID,
				name: "testing-join-player",
			},
		});

		expect(resultJoinEvent.meta.status).toBe(200);
		expect(resultJoinEvent.data).toBeUndefined();

		const resultLeaveEvent = await client.createPlaylogEvent(playID, {
			type: "LeavePlayer",
			values: {
				userId: userID,
			},
		});

		expect(resultLeaveEvent.meta.status).toBe(200);
		expect(resultLeaveEvent.data).toBeUndefined();
	});
});
