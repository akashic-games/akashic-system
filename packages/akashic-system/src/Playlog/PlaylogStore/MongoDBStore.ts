import * as mongodb from "mongodb";
import { encodeTick, encodeStartPoint, decodeTick, decodeStartPoint } from "@akashic/amflow-message";
import { PlaylogStoreError } from "./PlaylogStoreError";
import { PlaylogStoreStartPointConflictError } from "./PlaylogStoreStartPointConflictError";
import { PlaylogStoreTickConflictError } from "./PlaylogStoreTickConflictError";

import type { Tick } from "@akashic/playlog";
import type { StartPoint } from "@akashic/amflow";
import type { GetTicksQuery, GetStartPointsQuery, IPlaylogActiveStore, ExcludeEventFlags } from "./PlaylogActiveStore/IPlaylogActiveStore";
import type { IPlaylogArchiveStore } from "./PlaylogArchiveStore/IPlaylogArchiveStore";

export type TickRecord = {
	playId: string;
	frame: number;
	data: mongodb.Binary;
};

export type StartPointRecord = {
	playId: string;
	frame: number;
	timestamp: number | null;
	startPoint: mongodb.Binary;
};

export function toTickRecord(playId: string, tick: Tick): TickRecord {
	const data = new mongodb.Binary(encodeTick(tick));
	return { playId, frame: tick[0], data };
}
export function toStartPointRecord(playId: string, startPoint: StartPoint): StartPointRecord {
	const data = new mongodb.Binary(encodeStartPoint(startPoint));
	return { playId, frame: startPoint.frame, timestamp: startPoint.timestamp, startPoint: data };
}

export const playlogCollectionName = "playlogs";
export const startPointCollectionName = "startpoints";
const excludedIgnorablePostfix: string = "_ignored";

export function getPlayIdKey(playId: string, excludeEventFlags: ExcludeEventFlags | undefined) {
	return excludeEventFlags?.ignorable ? playId + excludedIgnorablePostfix : playId;
}

export class MongoDBStore implements IPlaylogActiveStore, IPlaylogArchiveStore {
	private readonly playlogCollection: mongodb.Collection<TickRecord>;
	private readonly startPointCollection: mongodb.Collection<StartPointRecord>;
	constructor(db: mongodb.Db) {
		this.playlogCollection = db.collection(playlogCollectionName);
		this.startPointCollection = db.collection(startPointCollectionName);
	}

	/**
	 * アーカイブから取り出したticksとstartPointをmongoDBに保存する
	 * 注: この関数は多重呼び出し禁止。必ずplayId単位でのlockを取る
	 */
	async store(playId: string, ticks: { original: Tick[]; excludedIgnorable: Tick[] }, startPoints: StartPoint[]): Promise<void> {
		const originalPlayIdKey = getPlayIdKey(playId, { ignorable: false });
		const excludedIgnorablePlayIdKey = getPlayIdKey(playId, { ignorable: true });

		const originalTickRecords = ticks.original.map((tick) => toTickRecord(originalPlayIdKey, tick));
		const excludedIgnorableTickRecords = ticks.excludedIgnorable.map((tick) => toTickRecord(excludedIgnorablePlayIdKey, tick));

		const startPointRecords = startPoints.map((startPoint) => toStartPointRecord(playId, startPoint));

		try {
			await this.playlogCollection.deleteMany({ playId: originalPlayIdKey });
			await this.playlogCollection.deleteMany({ playId: excludedIgnorablePlayIdKey });

			await this.startPointCollection.deleteMany({ playId });

			await this.playlogCollection.insertMany(originalTickRecords);
			await this.playlogCollection.insertMany(excludedIgnorableTickRecords);

			await this.startPointCollection.insertMany(startPointRecords);
		} catch (error) {
			const err = error as mongodb.MongoError;
			throw new PlaylogStoreError(err.message, playId, "other", err);
		}
	}

	async putTick(playId: string, tick: Tick, excludeEventFlags?: ExcludeEventFlags): Promise<void> {
		const playIdKey = getPlayIdKey(playId, excludeEventFlags);
		const record = toTickRecord(playIdKey, tick);

		try {
			await this.playlogCollection.insertOne(record);
		} catch (error) {
			const err = error as mongodb.MongoError;
			if (err.code === 11000) {
				throw new PlaylogStoreTickConflictError(err.message, playId, tick, excludeEventFlags, err);
			}
			throw new PlaylogStoreError(err.message, playId, "other", err);
		}
	}

	async putStartPoint(playId: string, startPoint: StartPoint): Promise<void> {
		const record = toStartPointRecord(playId, startPoint);
		try {
			await this.startPointCollection.insertOne(record);
		} catch (error) {
			const err = error as mongodb.MongoError;
			if (err.code === 11000) {
				throw new PlaylogStoreStartPointConflictError(err.message, playId, startPoint, err);
			}
			throw new PlaylogStoreError(err.message, playId, "other", err);
		}
	}

	async updateTick(playId: string, tick: Tick): Promise<void> {
		const originalPlayIdKey = getPlayIdKey(playId, { ignorable: false });
		const query = { playId: originalPlayIdKey, frame: tick[0] };
		const record = toTickRecord(originalPlayIdKey, tick);

		try {
			await this.playlogCollection.findOneAndUpdate(query, { $set: record });
		} catch (error) {
			const err = error as mongodb.MongoError;
			throw new PlaylogStoreError(err.message, playId, "other", err);
		}

		const firstTickWithoutIgnorableEvent = await this.getTick(playId, 1, { ignorable: false });
		if (firstTickWithoutIgnorableEvent) {
			const playIdKeyForTicksWithoutIgnorableEvent = getPlayIdKey(playId, { ignorable: false });
			const queryForTicksWithoutIgnorableEvent = { playId: playIdKeyForTicksWithoutIgnorableEvent, frame: tick[0] };
			const recordWithoutIgnorableEvent = toTickRecord(playIdKeyForTicksWithoutIgnorableEvent, tick);

			try {
				await this.playlogCollection.findOneAndUpdate(queryForTicksWithoutIgnorableEvent, { $set: recordWithoutIgnorableEvent });
			} catch (error) {
				const err = error as mongodb.MongoError;
				throw new PlaylogStoreError(err.message, playId, "other", err);
			}
		}
	}

	async getTick(playId: string, frame: number, excludeEventFlags?: ExcludeEventFlags): Promise<Tick | null> {
		const playIdKey = getPlayIdKey(playId, excludeEventFlags);
		const query: mongodb.Filter<TickRecord> = { playId: playIdKey, frame };

		let record: TickRecord | null;
		try {
			record = await this.playlogCollection.findOne(query);
		} catch (error) {
			const err = error as mongodb.MongoError;
			throw new PlaylogStoreError(err.message, playId, "other", err);
		}

		if (!record && excludeEventFlags?.ignorable) {
			try {
				/**
				 * 旧バージョンのtickはignorableなtickがmongodbに保存されていない可能性がある
				 * そのためignorableイベント除外済みtickを取得しようとして結果が空だった場合は、通常版にデータがあるかもしれないので再取得
				 */
				const retryQuery: mongodb.Filter<TickRecord> = {
					playId: getPlayIdKey(playId, { ...(excludeEventFlags ?? {}), ignorable: false }),
					frame,
				};
				record = await this.playlogCollection.findOne(retryQuery);
			} catch (error) {
				const err = error as mongodb.MongoError;
				throw new PlaylogStoreError(err.message, playId, "other", err);
			}
		}

		if (!record) {
			return null;
		}

		return decodeTick(Buffer.from(record.data.read(0, record.data.length())));
	}

	async getTicks(query: GetTicksQuery): Promise<Tick[]> {
		const bufferList = await this.getTicksRaw(query);
		return bufferList.map((buffer) => decodeTick(buffer));
	}

	async getTicksRaw({ playId, frameFrom, frameTo, limit, excludeEventFlags }: GetTicksQuery): Promise<Buffer[]> {
		// クエリの組み立て
		const playIdKey = getPlayIdKey(playId, excludeEventFlags);
		const frame: mongodb.Condition<number> = {};
		let useFrame = false;
		if (frameFrom !== undefined) {
			frame.$gte = frameFrom;
			useFrame = true;
		}
		if (frameTo !== undefined) {
			frame.$lt = frameTo;
			useFrame = true;
		}
		const findQuery: mongodb.Filter<TickRecord> = useFrame ? { playId: playIdKey, frame } : { playId: playIdKey };

		let records: TickRecord[];
		records = await this.getTicksInner(playId, findQuery, limit);

		if (records.length === 0 && excludeEventFlags?.ignorable) {
			/**
			 * 旧バージョンのtickはignorableなtickがmongodbに保存されていない可能性がある
			 * そのためignorableイベント除外済みtickを取得しようとして結果が空だった場合は、通常版にデータがあるかもしれないので再取得
			 */
			findQuery.playId = getPlayIdKey(playId, { ...(excludeEventFlags ?? {}), ignorable: false });
			records = await this.getTicksInner(playId, findQuery, limit);
		}

		return records.map((record) => Buffer.from(record.data.read(0, record.data.length())));
	}

	async getAllTicks(playId: string): Promise<{ original: Tick[]; excludedIgnorable: Tick[] }> {
		const originalPlayIdKey = getPlayIdKey(playId, { ignorable: false });
		const ignorablePlayIdKey = getPlayIdKey(playId, { ignorable: true });

		let originalRecords: TickRecord[];
		let excludedIgnorableRecords: TickRecord[];
		try {
			originalRecords = await this.playlogCollection.find({ playId: originalPlayIdKey }).sort({ frame: 1 }).toArray();
			excludedIgnorableRecords = await this.playlogCollection.find({ playId: ignorablePlayIdKey }).sort({ frame: 1 }).toArray();
		} catch (error) {
			const err = error as mongodb.MongoError;
			throw new PlaylogStoreError(err.message, playId, "other", err);
		}

		return {
			original: originalRecords.map((record) => decodeTick(Buffer.from(record.data.read(0, record.data.length())))),
			excludedIgnorable: excludedIgnorableRecords.map((record) => decodeTick(Buffer.from(record.data.read(0, record.data.length())))),
		};
	}

	async getStartPoint(playId: string, frame: number): Promise<StartPoint | null> {
		let record: StartPointRecord | null;
		try {
			record = await this.startPointCollection.findOne({ playId, frame });
		} catch (error) {
			const err = error as mongodb.MongoError;
			throw new PlaylogStoreError(err.message, playId, "other", err);
		}

		if (!record) {
			return null;
		}

		return decodeStartPoint(Buffer.from(record.startPoint.read(0, record.startPoint.length())));
	}

	async getStartPoints({ playId, limit }: GetStartPointsQuery): Promise<StartPoint[]> {
		let records: StartPointRecord[];
		try {
			records = await this.startPointCollection.find({ playId }).limit(limit).sort({ frame: 1 }).toArray();
		} catch (error) {
			const err = error as mongodb.MongoError;
			throw new PlaylogStoreError(err.message, playId, "other", err);
		}
		return records.map((record: StartPointRecord) => decodeStartPoint(Buffer.from(record.startPoint.read(0, record.startPoint.length()))));
	}

	async getClosestStartPoint(playId: string, frame: number): Promise<StartPoint | null> {
		// cf. https://github.com/akashic-games/amflow/pull/49
		// この値以下で最大の `frame` を持つ開始地点情報を取得する。
		const query = {
			playId,
			frame: {
				$lte: frame,
			},
		};
		let records: StartPointRecord[];
		try {
			records = await this.startPointCollection.find(query).limit(1).sort({ frame: -1 }).toArray();
		} catch (error) {
			const err = error as mongodb.MongoError;
			throw new PlaylogStoreError(err.message, playId, "other", err);
		}

		if (records.length) {
			const data = records[0].startPoint;
			return decodeStartPoint(Buffer.from(data.read(0, data.length())));
		} else {
			return null;
		}
	}

	async getClosestStartPointByTimestamp(playId: string, timestamp: number): Promise<StartPoint | null> {
		// cf. https://github.com/akashic-games/amflow/pull/49
		// この値よりも小さい内で最大の `timestamp` を持つ開始地点情報を取得する。
		const query = {
			playId,
			timestamp: {
				$lt: timestamp,
			},
		};
		let records: StartPointRecord[];
		try {
			records = await this.startPointCollection.find(query).limit(1).sort({ timestamp: -1 }).toArray();
		} catch (error) {
			const err = error as mongodb.MongoError;
			throw new PlaylogStoreError(err.message, playId, "other", err);
		}

		if (records.length) {
			const data = records[0].startPoint;
			return decodeStartPoint(Buffer.from(data.read(0, data.length())));
		} else {
			return null;
		}
	}

	async getAllStartPoints(playId: string): Promise<StartPoint[]> {
		let records: StartPointRecord[];
		try {
			records = await this.startPointCollection.find({ playId }).sort({ frame: 1 }).toArray();
		} catch (error) {
			const err = error as mongodb.MongoError;
			throw new PlaylogStoreError(err.message, playId, "other", err);
		}
		return records.map((record) => decodeStartPoint(Buffer.from(record.startPoint.read(0, record.startPoint.length()))));
	}

	async deleteAll(playId: string): Promise<void> {
		const originalPlayIdKey = getPlayIdKey(playId, { ignorable: false });
		const excludedIgnorablePlayIdKey = getPlayIdKey(playId, { ignorable: true });

		try {
			await this.playlogCollection.deleteMany({ playId: originalPlayIdKey });
			await this.playlogCollection.deleteMany({ playId: excludedIgnorablePlayIdKey });

			await this.startPointCollection.deleteMany({ playId });
		} catch (error) {
			const err = error as mongodb.MongoError;
			throw new PlaylogStoreError(err.message, playId, "other", err);
		}
	}

	private async getTicksInner(playId: string, findQuery: mongodb.Filter<TickRecord>, limit: number) {
		try {
			return await this.playlogCollection.find(findQuery).limit(limit).sort({ frame: 1 }).toArray();
		} catch (error) {
			const err = error as mongodb.MongoError;
			throw new PlaylogStoreError(err.message, playId, "other", err);
		}
	}
}
