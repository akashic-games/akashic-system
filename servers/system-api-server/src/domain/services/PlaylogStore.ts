import * as amflow from "@akashic/amflow";
import * as amflowMessage from "@akashic/amflow-message";
import * as playlog from "@akashic/playlog";

import type { PlaylogStoreConnection } from "./PlaylogStoreConnection";
import type { IPlaylogStore, ExcludeEventFlags } from "@akashic/akashic-system";

export interface PlayData {
	tickList: playlog.TickList;
	startPoints: amflow.StartPoint[];
}

export class PlaylogStore {
	private _playlogStore: IPlaylogStore;

	constructor(playlogStoreConnection: PlaylogStoreConnection) {
		this._playlogStore = playlogStoreConnection.getPlaylogStore();
	}

	public getPlaylogData(playId: string, excludeEventFlags?: ExcludeEventFlags): Promise<PlayData> {
		const result: PlayData = {
			tickList: null,
			startPoints: null,
		};
		return this._playlogStore
			.getTicks({ playId, limit: 0, excludeEventFlags })
			.then((ticks: playlog.Tick[]) => {
				result.tickList = amflowMessage.fromTicks(ticks);
				return this._playlogStore.getStartPoints({ playId, limit: 0 });
			})
			.then((startPoints: amflow.StartPoint[]) => {
				result.startPoints = startPoints;
				// frame0 の StartPoint が無い場合は playlog 無しという扱いにする
				if (startPoints && startPoints.length && startPoints[0].frame === 0) {
					return result;
				} else {
					return null;
				}
			});
	}

	// 書き込み先にデータが存在するかどうかの確認
	public exists(playId: string): Promise<boolean> {
		return Promise.all([this._playlogStore.getTicks({ playId, limit: 1 }), this._playlogStore.getStartPoints({ playId, limit: 1 })]).then(
			([ticks, startPoints]) => {
				if ((ticks && ticks.length) || (startPoints && startPoints.length)) {
					return true;
				}
				return false;
			},
		);
	}

	public putTick(playId: string, tick: playlog.Tick): Promise<void> {
		return this._playlogStore.putTick(playId, tick);
	}

	public updateTick(playId: string, tick: playlog.Tick): Promise<void> {
		return this._playlogStore.updateTick(playId, tick);
	}

	public putStartPoint(playId: string, startPoint: amflow.StartPoint): Promise<void> {
		return this._playlogStore.putStartPoint(playId, startPoint);
	}

	public async putPlaylogData(playId: string, playData: PlayData, count?: number, excludeEventFlags?: ExcludeEventFlags): Promise<void> {
		const ticks: playlog.Tick[] = amflowMessage.toTicks(playData.tickList);
		const frameEnd: number = count ? Math.min(count, ticks.length) : ticks.length;
		await this._putTicks(playId, ticks, frameEnd, excludeEventFlags);
		// ignorable eventの場合でもstart pointは多重化しない
		if (!excludeEventFlags?.ignorable) {
			this._putStartPoints(playId, playData.startPoints, frameEnd);
		}
	}

	private _putTicks(playId: string, ticks: playlog.Tick[], frameEnd: number, excludeEventFlags?: ExcludeEventFlags): Promise<void> {
		let frame: number = 0;
		const doPutTicks = (): Promise<void> => {
			if (frame >= frameEnd) {
				return Promise.resolve(undefined);
			}
			return this._playlogStore.putTick(playId, ticks[frame], excludeEventFlags).then(() => {
				++frame;
				return doPutTicks();
			});
		};
		return doPutTicks();
	}

	private _putStartPoints(playId: string, startPoints: amflow.StartPoint[], frameEnd: number): Promise<void> {
		const filtered: amflow.StartPoint[] = startPoints.filter((startPoint) => startPoint.frame < frameEnd);
		let index = 0;
		const doPutStartPoints = (): Promise<void> => {
			if (index >= filtered.length) {
				return Promise.resolve(undefined);
			}
			return this._playlogStore.putStartPoint(playId, filtered[index]).then(() => {
				++index;
				return doPutStartPoints();
			});
		};
		return doPutStartPoints();
	}
}
