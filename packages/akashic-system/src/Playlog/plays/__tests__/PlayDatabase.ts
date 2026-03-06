import "jest";
import config from "config";
import { createPool, PoolConfig } from "mysql";
import { PlayDatabase } from "../PlayDatabase";
import { Constants } from "@akashic/server-engine-data-types";

describe("PlayDatabase", () => {
	const playId1 = "8732010283051";
	const playId2 = "8732090283053";

	it("getStartedのテスト", async () => {
		const pool = createPool(config.get("mysql"));
		const playDatabase = new PlayDatabase(pool);
		const sqlString = `
			INSERT IGNORE INTO plays (id, gameCode, started, status)
			VALUES (?, '', '2020-11-09 11:59:54', ?)
		`;
		await new Promise<void>((resolve, reject) =>
			pool.query(sqlString, [playId1, Constants.PLAY_STATE_RUNNING], (err) => (err ? reject(err) : resolve())),
		);

		const started = await playDatabase.getStarted(playId1);
		expect(started?.toISOString()).toBe("2020-11-09T02:59:54.000Z");
		await expect(playDatabase.getStarted(playId2)).resolves.toBe(null);
		// 後片付け
		pool.end();
	});

	it("getStartedの異常系テスト", async () => {
		const invalidPool = createPool({ ...config.get<PoolConfig>("mysql"), host: "mysql.invalid" });
		const invalidPlayDatabase = new PlayDatabase(invalidPool);
		await expect(invalidPlayDatabase.getStarted(playId1)).rejects.toThrow(/ENOTFOUND/);
		// 後片付け
		invalidPool.end();
	});
});
