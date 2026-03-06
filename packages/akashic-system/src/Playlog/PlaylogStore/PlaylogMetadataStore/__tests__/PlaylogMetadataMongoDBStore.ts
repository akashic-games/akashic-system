import config from "config";
import { MongoClient } from "mongodb";
import { PlaylogMetadataMongoDBStore, playlogMetadataCollectionName, PlaylogMetadata } from "../PlaylogMetadataMongoDBStore";

describe("PlaylogMetadataMongoDBStoreのlargeテスト", () => {
	it("shouldGetFromArchiveのテスト", async () => {
		// 初期化処理
		const playId = "42352987492";
		const client = new MongoClient(config.get("mongodb.url"));
		await client.connect();
		const db = client.db("akashic_test");
		const store = new PlaylogMetadataMongoDBStore(db);

		// デフォルトはfalse
		const result1 = await store.shouldGetFromArchive(playId);
		expect(result1).toBe(false);
		// 更新できる
		await store.setShouldGetFromArchive(playId, true);
		const result2 = await store.shouldGetFromArchive(playId);
		expect(result2).toBe(true);
		await store.setShouldGetFromArchive(playId, false);
		const result3 = await store.shouldGetFromArchive(playId);
		expect(result3).toBe(false);

		// 終了処理
		await client.close();
	});

	it("hasArchiveのテスト", async () => {
		// 初期化処理
		const playId = "42352987493";
		const client = new MongoClient(config.get("mongodb.url"));
		await client.connect();
		const db = client.db("akashic_test");
		const store = new PlaylogMetadataMongoDBStore(db);

		// デフォルトはfalse
		const result1 = await store.getHasArchived(playId);
		expect(result1).toBe(false);
		// 更新できる
		await store.setHasArchived(playId, true);
		const result2 = await store.getHasArchived(playId);
		expect(result2).toBe(true);
		await store.setHasArchived(playId, false);
		const result3 = await store.getHasArchived(playId);
		expect(result3).toBe(false);

		// 終了処理
		await client.close();
	});

	it("updateLastAccessTimeのテスト", async () => {
		const playId = "42352987494";
		// 初期化処理
		const client = new MongoClient(config.get("mongodb.url"));
		await client.connect();
		const db = client.db("akashic_test");
		const store = new PlaylogMetadataMongoDBStore(db);

		// テスト
		const now = Date.now();
		await store.updateLastAccessTime(playId);
		const result = await db.collection<PlaylogMetadata>(playlogMetadataCollectionName).findOne({ playId });
		expect(result?.lastAccessTime?.getTime()).toBeGreaterThanOrEqual(now);

		// 終了処理
		await client.close();
	});

	it("conflict時にはsetPlaylogMetadataのupdateFuncは再度呼び出される", async () => {
		const playId = "12348079";
		// tslint:disable-next-line max-classes-per-file
		class ConflictTest1 extends PlaylogMetadataMongoDBStore {
			called = 0;
			async conflictTest(id: string) {
				return this.setPlaylogMetadata(id, async (metadata) => {
					this.called++;
					if (this.called === 1) {
						const metadata2 = { ...metadata, revision: metadata.revision + 1 };
						await this.metadataCollection.updateOne({ playId: id }, { $set: metadata2 });
					}
					return metadata;
				});
			}
		}
		const client = new MongoClient(config.get("mongodb.url"));
		await client.connect();
		const db = client.db("akashic_test");
		const conflictTest1 = new ConflictTest1(db);
		const store = new PlaylogMetadataMongoDBStore(db);
		await store.updateLastAccessTime(playId);

		await conflictTest1.conflictTest(playId);

		expect(conflictTest1.called).toBe(2);
	});

	it("何回もconflictする場合はsetPlaylogMetadataは例外を投げる", async () => {
		const playId = "123480791";
		// tslint:disable-next-line max-classes-per-file
		class ConflictTest2 extends PlaylogMetadataMongoDBStore {
			async conflictTest(id: string) {
				return this.setPlaylogMetadata(id, async (metadata) => {
					const metadata2 = { ...metadata, revision: metadata.revision + 1 };
					await this.metadataCollection.updateOne({ playId: id }, { $set: metadata2 });
					return metadata;
				});
			}
		}
		const client = new MongoClient(config.get("mongodb.url"));
		await client.connect();
		const db = client.db("akashic_test");
		const conflictTest2 = new ConflictTest2(db);
		const store = new PlaylogMetadataMongoDBStore(db);
		await store.updateLastAccessTime(playId);

		await expect(conflictTest2.conflictTest(playId)).rejects.toThrow(/更新が競合しました/);
	});

	it("updateLastAccessTimeは、更新前後の時間が小さい場合はlastAccessTimeを更新しない", async () => {
		const playId = "123480792";
		// tslint:disable-next-line max-classes-per-file
		class IgnoreUpdateTest extends PlaylogMetadataMongoDBStore {
			now = new Date("2021-01-29T12:00:00+09:00");

			getNow() {
				return this.now;
			}

			async getPlaylogMetadata(id: string) {
				return super.getPlaylogMetadata(id);
			}
		}
		const client = new MongoClient(config.get("mongodb.url"));
		await client.connect();
		const db = client.db("akashic_test");
		const ignoreUpdateTest = new IgnoreUpdateTest(db);

		await ignoreUpdateTest.updateLastAccessTime(playId);
		expect((await ignoreUpdateTest.getPlaylogMetadata(playId)).lastAccessTime?.getTime()).toBe(
			new Date("2021-01-29T12:00:00+09:00").getTime(),
		);

		// 1分程度では更新されない
		ignoreUpdateTest.now = new Date("2021-01-29T12:01:00+09:00");
		await ignoreUpdateTest.updateLastAccessTime(playId);
		expect((await ignoreUpdateTest.getPlaylogMetadata(playId)).lastAccessTime?.getTime()).toBe(
			new Date("2021-01-29T12:00:00+09:00").getTime(),
		);

		// 5分経過していたら更新される
		ignoreUpdateTest.now = new Date("2021-01-29T12:05:00+09:00");
		await ignoreUpdateTest.updateLastAccessTime(playId);
		expect((await ignoreUpdateTest.getPlaylogMetadata(playId)).lastAccessTime?.getTime()).toBe(
			new Date("2021-01-29T12:05:00+09:00").getTime(),
		);
	});
});
