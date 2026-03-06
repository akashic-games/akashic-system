import { S3Client } from "@aws-sdk/client-s3";
import config from "config";
import { gzip } from "zlib";

import { PlaylogS3Store } from "../PlaylogS3Store";

import type { Tick } from "@akashic/playlog";
import type { StartPoint } from "@akashic/amflow";
import { Readable } from "stream";

describe("PlaylogS3Storeのlargeテスト", () => {
	const bucketName = config.get<string>("archiveSettings.bucket");

	const tick1: Tick = [1];
	const tick2: Tick = [2];
	const startPoint1: StartPoint = {
		frame: 1,
		timestamp: 12345678,
		data: "data",
	};
	const startPoint2: StartPoint = {
		frame: 2,
		timestamp: 12345678,
		data: "data2",
	};

	it("store/archive周りのテスト", async () => {
		// 初期化処理
		const playId = "98798743";
		const s3 = new S3Client({
			endpoint: config.get("s3.endpoint"),
			credentials: {
				accessKeyId: config.get("s3.accessKeyId"),
				secretAccessKey: config.get("s3.secretAccessKey"),
			},
			region: "ap-northeast-1",
			forcePathStyle: true,
		});

		// テスト
		const store = new PlaylogS3Store(s3, { bucket: bucketName });
		await store.store(
			playId,
			{
				original: [tick1, tick2],
				excludedIgnorable: [tick1, tick2],
			},
			[startPoint1, startPoint2],
		);

		const result1 = await store.getAllTicks(playId);
		const result2 = await store.getAllStartPoints(playId);
		expect(result1).toEqual({ original: [tick1, tick2], excludedIgnorable: [tick1, tick2] });
		expect(result2).toEqual([startPoint1, startPoint2]);
		await expect(store.getAllTicks("123")).rejects.toThrow(/アーカイブストアにありません/);
		await expect(store.getAllStartPoints("123")).rejects.toThrow(/アーカイブストアにありません/);
	});

	it("s3への通信が失敗するケース", async () => {
		const playId = "98798744";
		const invalidS3 = new S3Client({
			endpoint: "https://s3.invalid",
			credentials: {
				accessKeyId: config.get("s3.accessKeyId"),
				secretAccessKey: config.get("s3.secretAccessKey"),
			},
			region: "ap-northeast-1",
			forcePathStyle: true,
		});
		const store = new PlaylogS3Store(invalidS3, { bucket: bucketName });

		await expect(
			store.store(playId, { original: [tick1, tick2], excludedIgnorable: [tick1, tick2] }, [startPoint1, startPoint2]),
		).rejects.toThrow(/ENOTFOUND/);
		await expect(store.getAllTicks(playId)).rejects.toThrow(/ENOTFOUND/);
		await expect(store.getAllStartPoints(playId)).rejects.toThrow(/ENOTFOUND/);
	});

	it("s3から変なのが返ってきたケース", async () => {
		// 初期化処理
		const playId = "98798745";
		const s3 = new S3Client({
			endpoint: config.get("s3.endpoint"),
			credentials: {
				accessKeyId: config.get("s3.accessKeyId"),
				secretAccessKey: config.get("s3.secretAccessKey"),
			},
			region: "ap-northeast-1",
			forcePathStyle: true,
		});
		const store = new PlaylogS3Store(s3, { bucket: bucketName });

		// S3から変なのを返すためにgetObject差し替え
		const gzippedData = await new Promise<Buffer>((resolve, reject) => {
			gzip(JSON.stringify({ hoge: "fuga" }), (err, result) => {
				if (err) {
					reject(err);
				} else {
					resolve(result);
				}
			});
		});
		const bodyList = [Buffer.from("abc", "utf-8"), gzippedData];
		s3.send = jest.fn().mockImplementation(() => {
			return {
				Body: Readable.from(bodyList.splice(0, 1)),
			};
		});

		// テスト
		await expect(store.getAllTicks(playId)).rejects.toThrow(/incorrect header check/);
		await expect(store.getAllTicks(playId)).rejects.toThrow(/配列ではありません/);
	});
});
