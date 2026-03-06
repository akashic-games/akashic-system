import type { IPlaylogStore, ExcludeEventFlags, GetTicksQuery } from "@akashic/akashic-system";

import { TickIndex } from "@akashic/playlog";
import { StartPointCacheManager } from "./StartPointCache";
import { TickCacheManager } from "./TickCache";
import type { StartPoint } from "@akashic/amflow";
import type { StorageData } from "@akashic/playlog";
import type { LogUtil } from "@akashic/log-util";

const STARTPOINT_MAX_RETRY = 5;
const STARTPOINT_RETRY_TIMEOUT = 2000;

export class RequestHandler {
	private _playlogStore: IPlaylogStore;
	private _logger: LogUtil | null;
	private _tickCacheManager: TickCacheManager;
	private _startPointCacheManager: StartPointCacheManager;
	private _refCounts: { [playId: string]: number };

	constructor(playlogStore: IPlaylogStore, logger: LogUtil | null) {
		this._playlogStore = playlogStore;
		this._logger = logger;

		this._tickCacheManager = new TickCacheManager(this._getRawTickList.bind(this));
		this._startPointCacheManager = new StartPointCacheManager(this._tryToGetStartPoint.bind(this));

		this._refCounts = {};
	}

	public ref(playId: string): void {
		if (this._refCounts[playId] == null) {
			this._refCounts[playId] = 0;
		}
		this._refCounts[playId]++;
		// 最終アクセス日時を更新する。
		// 起動時に更新するのは厳密な最終アクセス日時にはならないが、あくまでもアーカイブ処理するかどうかの判断材料でしかないのでここで更新する
		this._playlogStore.updateLastAccessTime(playId).catch((err) => {
			this._logger?.warn("プレイログの最終アクセス日時の更新に失敗しました。当該ログが高頻度で出力される場合は問題の可能性あり:", err);
		});
	}

	public unref(playId: string): void {
		if (this._refCounts[playId] == null) {
			return;
		}
		this._refCounts[playId]--;
		if (this._refCounts[playId] === 0) {
			delete this._refCounts[playId];
			this._tickCacheManager.purge(playId);
			this._startPointCacheManager.purge(playId);
		}
	}

	public getTickCacheManager(): TickCacheManager {
		return this._tickCacheManager;
	}

	public async getStorageDataFromTick(playId: string, frame: number): Promise<StorageData[]> {
		const tick = await this._playlogStore.getTick(playId, frame);
		if (!tick) {
			return [];
		}
		return tick[TickIndex.StorageData];
	}

	public async getRawTickList(playId: string, begin: number, end: number): Promise<Buffer[]> {
		if (!(end - begin > 0)) {
			return [];
		}
		return this._tickCacheManager.getCache(playId).get(begin, end);
	}

	public async getRawTickListExcludedIgnorable(
		playId: string,
		begin: number,
		end: number,
		excludeEventFlags?: ExcludeEventFlags,
	): Promise<Buffer[]> {
		if (!(end - begin > 0)) {
			return [];
		}
		return this._playlogStore.getTicksRaw({ playId, frameFrom: begin, frameTo: end, limit: end - begin, excludeEventFlags });
	}

	public async getStartPoint(playId: string, option?: { frame?: number; timestamp?: number }): Promise<StartPoint> {
		// frame と timestamp の両方が指定された場合は frame 優先とする(実装依存):
		const frame = option?.frame ?? null;
		const timestamp = option?.timestamp ?? null;

		if (frame != null && frame !== 0) {
			return this._playlogStore.getClosestStartPoint(playId, frame);
		}

		if (timestamp != null) {
			const startPoint = await this._playlogStore.getClosestStartPointByTimestamp(playId, timestamp);
			if (startPoint) {
				this._logger.info(`Closest startPoint found. playId: ${playId}, timestamp: ${timestamp}, startPoint: ${startPoint.timestamp}`);
				return startPoint;
			}
			// 過去のデータに timestamp が存在しないものがある。その場合は第0を返す:
			this._logger.info(`Closest startPoint not found. playId: ${playId}, timestamp: ${timestamp}`);
		}

		// 無指定の場合は 第0 を返す:
		const startPoint = await this._playlogStore.getStartPoint(playId, 0);
		if (startPoint === null) {
			this._logger.warn(`empty startPoint. playId: ${playId}`);
		}
		return startPoint;
	}

	public async putStartPoint(playId: string, startPoint: StartPoint): Promise<void> {
		return this._playlogStore.putStartPoint(playId, startPoint);
	}

	private async _getRawTickList(playId: string, begin: number, end: number): Promise<Buffer[]> {
		return this._playlogStore.getTicksRaw({ playId, frameFrom: begin, frameTo: end, limit: end - begin });
	}

	// TODO: リトライは第0スタートポイントの扱いが決まるまでの暫定対応
	private _tryToGetStartPoint(playId: string, frame: number, _retry: number = 0): Promise<StartPoint> {
		return this._playlogStore
			.getStartPoint(playId, frame)
			.then((startPoint) => {
				if (startPoint) {
					return startPoint;
				} else {
					return Promise.reject<null>(null);
				}
			})
			.catch(() => {
				if (_retry >= STARTPOINT_MAX_RETRY) {
					return Promise.reject(null);
				}
				_retry++;
				return new Promise<StartPoint>((resolve, reject) => {
					setTimeout(() => {
						this._tryToGetStartPoint(playId, frame, _retry).then(resolve, reject);
					}, STARTPOINT_RETRY_TIMEOUT);
				});
			});
	}
}
