import { Readable } from "stream";
import { gunzip, gzip } from "zlib";
import { GetObjectCommand, GetObjectOutput, PutObjectCommand, S3Client, S3ServiceException } from "@aws-sdk/client-s3";
import { PlaylogStoreError } from "../PlaylogStoreError";

import type { Tick } from "@akashic/playlog";
import type { StartPoint } from "@akashic/amflow";
import type { IPlaylogArchiveStore } from "./IPlaylogArchiveStore";

export type PlaylogS3StoreSettings = {
	bucket: string;
};

const originalTicksFileName = "ticks.json.gz" as const;
const excludedIgnorableTicksFileName = "ticks_excluded_ignorable.json.gz" as const;
const startPointsFileName = "startPoints.json.gz" as const;

type FileNameTypeMap = {
	[originalTicksFileName]: Tick;
	[excludedIgnorableTicksFileName]: Tick;
	[startPointsFileName]: StartPoint;
};

export class PlaylogS3Store implements IPlaylogArchiveStore {
	private readonly s3: S3Client;
	private readonly settings: PlaylogS3StoreSettings;

	constructor(s3: S3Client, settings: PlaylogS3StoreSettings) {
		this.s3 = s3;
		this.settings = settings;
	}

	async store(playId: string, ticks: { original: Tick[]; excludedIgnorable: Tick[] }, startPoints: StartPoint[]): Promise<void> {
		await this.storeToS3(playId, originalTicksFileName, ticks.original);
		await this.storeToS3(playId, excludedIgnorableTicksFileName, ticks.excludedIgnorable);
		await this.storeToS3(playId, startPointsFileName, startPoints);
	}

	async getAllTicks(playId: string): Promise<{ original: Tick[]; excludedIgnorable: Tick[] }> {
		const originalTicks = await this.readFromS3(playId, originalTicksFileName);
		const excludedIgnorableTicks = await this.readFromS3(playId, excludedIgnorableTicksFileName);
		originalTicks.sort((a, b) => a[0] - b[0]);
		excludedIgnorableTicks.sort((a, b) => a[0] - b[0]);
		return { original: originalTicks, excludedIgnorable: excludedIgnorableTicks };
	}

	async getAllStartPoints(playId: string): Promise<StartPoint[]> {
		return await this.readFromS3(playId, startPointsFileName);
	}

	private async storeToS3<F extends keyof FileNameTypeMap>(playId: string, fileName: F, data: FileNameTypeMap[F][]): Promise<void> {
		try {
			const jsonString = JSON.stringify(data);
			const jsonGz = await new Promise<Buffer>((resolve, reject) => {
				gzip(jsonString, (err, result) => {
					if (err) {
						reject(err);
					} else {
						resolve(result);
					}
				});
			});

			const request = new PutObjectCommand({
				Bucket: this.settings.bucket,
				Body: jsonGz,
				ContentType: "application/json",
				ContentEncoding: "gzip",
				Key: `${playId}/${fileName}`,
			});
			await this.s3.send(request);
		} catch (error) {
			const err = error as Error;
			throw new PlaylogStoreError(err.message, playId, "other", err);
		}
	}

	private async readFromS3<F extends keyof FileNameTypeMap>(playId: string, fileName: F): Promise<FileNameTypeMap[F][]> {
		const request = new GetObjectCommand({
			Bucket: this.settings.bucket,
			Key: `${playId}/${fileName}`,
		});
		let getObjectOutput: GetObjectOutput;
		try {
			getObjectOutput = await this.s3.send(request);
		} catch (error) {
			const err = error as S3ServiceException;
			if (err.name === "NoSuchKey") {
				throw new PlaylogStoreError(`playId: ${playId}のファイル${fileName}がアーカイブストアにありません`, playId, "other", err);
			} else {
				throw new PlaylogStoreError(err.message, playId, "other", err);
			}
		}

		// v3ではbufferではなくReadable(webだとreadableStream)に変わった。型定義的にwebと|になっているので、node.jsの型に限定する
		const bodyReadable = getObjectOutput.Body as Readable | undefined;
		if (!bodyReadable) {
			throw new PlaylogStoreError(`playId: ${playId}のファイル${fileName}の中身がバイナリではありません`, playId, "other");
		}
		// Bufferに変更
		const body = await streamToBuffer(bodyReadable);

		let result: FileNameTypeMap[F][];
		try {
			const storedJSONString = await new Promise<string>((resolve, reject) => {
				gunzip(body, (err, buffer) => {
					if (err) {
						reject(err);
					} else {
						resolve(buffer.toString("utf-8"));
					}
				});
			});
			result = JSON.parse(storedJSONString);
		} catch (error) {
			const err = error as Error;
			throw new PlaylogStoreError(err.message, playId, "other", err);
		}

		if (!Array.isArray(result)) {
			throw new PlaylogStoreError(
				`playId: ${playId}のファイル${fileName}のパースに失敗しました。中身: ${result} が配列ではありません`,
				playId,
				"other",
			);
		}
		return result;
	}
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		stream.on("data", (chunk) => chunks.push(chunk));
		stream.on("end", () => resolve(Buffer.concat(chunks)));
		stream.on("error", (err) => reject(`error converting stream - ${err}`));
	});
}
