import "jest";
import config from "config";
import { createPool } from "mysql";
import { PlaylogDatabase } from "@akashic/akashic-system";

describe("PlaylogDatabaseの並列実行すると壊れるテスト", () => {
	it("正常系のテストとしてPlaylogDatabaseの操作を一通り試す", async () => {
		// 初期化処理
		const playId = "1102981022";
		const pool = createPool(config.get("mysql"));
		const sqlString = `TRUNCATE TABLE playlogs`;
		await new Promise((resolve, reject) => pool.query(sqlString, (err, results) => (err ? reject(err) : resolve(results))));
		const playlogDatabase = new PlaylogDatabase(pool);

		const result1 = await playlogDatabase.getWritingPlays();
		expect(result1.length).toBe(0);

		await playlogDatabase.setPlaying(playId);
		const result2 = await playlogDatabase.getWritingPlays();
		expect(result2[0].playId).toBe(playId);
		expect(result2[0].writeStatus).toBe("playing");

		await playlogDatabase.setClosing(playId);
		const result3 = await playlogDatabase.getWritingPlays();
		expect(result3[0].playId).toBe(playId);
		expect(result3[0].writeStatus).toBe("closing");

		await playlogDatabase.setClosed(playId);
		const result4 = await playlogDatabase.getWritingPlays();
		expect(result4.length).toBe(0);
		// 終了処理
		pool.end();
	});
	// 他のテストは通常のlargeテストで記載
});
