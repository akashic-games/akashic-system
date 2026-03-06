import type { Tick } from "@akashic/playlog";
import type { StartPoint } from "@akashic/amflow";

export type ExcludeEventFlags = {
	// ignorableイベントを除外したtickかどうか
	ignorable?: boolean;
};

export type GetTicksQuery = {
	playId: string;
	frameFrom?: number;
	frameTo?: number;
	limit: number;
	excludeEventFlags?: ExcludeEventFlags;
};

export type GetStartPointsQuery = {
	playId: string;
	limit: number;
};

export interface IPlaylogActiveStore {
	getTick(playId: string, frame: number, excludeEventFlags?: ExcludeEventFlags): Promise<Tick | null>;
	getTicks(query: GetTicksQuery): Promise<Tick[]>;
	getTicksRaw(query: GetTicksQuery): Promise<Buffer[]>;
	putTick(playId: string, tick: Tick, excludeEventFlags?: ExcludeEventFlags): Promise<void>;
	updateTick(playId: string, tick: Tick): Promise<void>;

	getStartPoint(playId: string, frame: number): Promise<StartPoint | null>;
	getStartPoints(query: GetStartPointsQuery): Promise<StartPoint[]>;
	/** 指定したフレームよりも前にある、一番近いスタートポイントを取得 */
	getClosestStartPoint(playId: string, frame: number): Promise<StartPoint | null>;
	getClosestStartPointByTimestamp(playId: string, timestamp: number): Promise<StartPoint | null>;

	putStartPoint(playId: string, startPoint: StartPoint): Promise<void>;

	deleteAll(playId: string): Promise<void>;
}
