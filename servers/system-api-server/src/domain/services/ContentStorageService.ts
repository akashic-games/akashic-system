import {
	GameExternalStorageReadRequest,
	GameExternalStorageReadResponse,
	GameExternalStorageWriteRequest,
	GameExternalStorageWriteResponse,
} from "@akashic/content-storage-types";

import { GameExternalStorageDataAccessBase } from "@akashic/akashic-storage-core";
import { RedisCommander } from "ioredis";

/**
 * コンテンツストレージの redis への保存と取得等を行う
 */
export default class ContentStorageService extends GameExternalStorageDataAccessBase {
	private _redis: RedisCommander;

	constructor(redis: RedisCommander) {
		super();
		this._redis = redis;
	}

	public async read(req: GameExternalStorageReadRequest): Promise<any> {
		return new Promise((resolve, reject) => {
			this.doRead(req, (error: Error | null, response: GameExternalStorageReadResponse | null) => {
				if (error) {
					return reject(error);
				}
				resolve(response);
			});
		});
	}

	public async write(req: GameExternalStorageWriteRequest): Promise<any> {
		return new Promise((resolve, reject) => {
			this.doWrite(req, (error: Error | null, response: GameExternalStorageWriteResponse | null) => {
				if (error) {
					return reject(error);
				}
				resolve(response);
			});
		});
	}

	protected async storageMget(keys: string[]): Promise<string[]> {
		const result = await this._redis.mget(keys);
		if (result) {
			return result;
		} else {
			return [];
		}
	}

	protected async storageMset(keys: string[], values: string[]): Promise<void> {
		const msetMap = new Map<string, any>();
		keys.forEach((key, index) => {
			msetMap.set(key, values[index]);
		});

		await this._redis.mset(msetMap);

		return;
	}

	protected async storageZadd(key: string, members: string[], scores: number[]): Promise<void> {
		const scoresAndMembers: (number | string)[] = [];
		scores.forEach((score, index) => {
			scoresAndMembers.push(score);
			scoresAndMembers.push(members[index]);
		});

		await this._redis.zadd(key, ...scoresAndMembers);

		return;
	}

	protected async storageZrange(key: string, start: number, end: number): Promise<string[]> {
		const zrangeResult = await this._redis.zrange(key, start, end, "WITHSCORES");

		if (zrangeResult && zrangeResult.length % 2 === 0) {
			// member と score が交互に配列に格納されているため、 member と scoreを ":" で結合する
			const result: string[] = [];
			for (let index = 0; index < zrangeResult.length; index++) {
				result.push(zrangeResult[index] + ":" + zrangeResult[index + 1]);
				index++;
			}
			return result;
		} else {
			return [];
		}
	}

	protected async storageZrank(key: string, rankOfPlayerId: string): Promise<string> {
		const result = await this._redis.zrank(key, rankOfPlayerId);
		if (result === null || result === undefined) {
			return null;
		} else {
			return `${result}`;
		}
	}
}
