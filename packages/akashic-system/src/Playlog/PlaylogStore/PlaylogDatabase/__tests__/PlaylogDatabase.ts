// tslint:disable no-empty
import "jest";
import config from "config";
import { createPool, PoolConfig } from "mysql";
import { PlaylogDatabase } from "../PlaylogDatabase";

function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("PlaylogDatabase", () => {
	// 正常系のテストは並列実行すると壊れるのでEnormousテストに移設
	it("lockのテスト", async () => {
		const pool = createPool(config.get("mysql"));
		const pool2 = createPool(config.get("mysql"));
		const playlogDatabase = new PlaylogDatabase(pool);
		const playlogDatabase2 = new PlaylogDatabase(pool2);

		const playId = "1102981023";
		let value = 1;
		await playlogDatabase.setPlaying(playId);
		await playlogDatabase.setClosed(playId);
		await Promise.all([
			playlogDatabase.withPlaylogLock(playId, async () => {
				// こっちのブロックの実行が終わってから
				value += 1;
				await wait(200);
				value += 1;
			}),
			playlogDatabase2.withPlaylogLock(playId, async () => {
				// こっちのブロックが実行される
				value *= 2;
			}),
		]);
		expect(value).toBe(6);
		// 終了処理
		pool.end();
		pool2.end();
	});

	it("レコードが無いとlockはエラーになる", async () => {
		const pool = createPool(config.get("mysql"));
		const playlogDatabase = new PlaylogDatabase(pool);

		const playId = "1102981024";
		await expect(playlogDatabase.withPlaylogLock(playId, async () => {})).rejects.toThrow("ロックが取れませんでした");
		// 終了処理
		pool.end();
	});

	it("mysqlに接続できないときのハンドリングチェック", async () => {
		const playId = "1102981025";
		const invalidPool = createPool({ ...config.get<PoolConfig>("mysql"), host: "mysql.invalid" });
		const invalidPlaylogDatabase = new PlaylogDatabase(invalidPool);

		await expect(invalidPlaylogDatabase.getWritingPlays()).rejects.toThrow("ENOTFOUND");
		await expect(invalidPlaylogDatabase.withPlaylogLock(playId, async () => {})).rejects.toThrow("ENOTFOUND");
		// 終了処理
		invalidPool.end();
	});

	it("playlogDatabaseのwithPlaylogLockの正常系テスト", async () => {
		const pool = createPool(config.get("mysql"));
		const playlogDatabase = new PlaylogDatabase(pool);
		// ロックを正しく確認するため、別のコネクションのPlaylogDatabaseを用意する
		const pool2 = createPool(config.get("mysql"));
		const playlogDatabase2 = new PlaylogDatabase(pool2);

		// playlogsレコードを作って準備する
		const playId = "1102981023";
		await playlogDatabase.setPlaying(playId);

		let value = 1;
		await Promise.all([
			// 2個のブロック内部がどう実行されるか？でテストする
			playlogDatabase.withPlaylogLock(playId, async () => {
				// こっちのブロックの実行が終わってから
				value += 1;
				await wait(200);
				value += 1;
			}),
			playlogDatabase2.withPlaylogLock(playId, async () => {
				// こっちのブロックが実行される
				value *= 2;
			}),
		]);

		// ブロックが直列に実行されているから6になる
		expect(value).toBe(6);

		pool2.end();
	});

	it("レコードが無いとwithPlaylogLockはエラーになる", async () => {
		const playId = "1102981024";
		const pool = createPool(config.get("mysql"));
		const playlogDatabase = new PlaylogDatabase(pool);

		await expect(playlogDatabase.withPlaylogLock(playId, async () => {})).rejects.toThrow("ロックが取れませんでした");
	});
});
