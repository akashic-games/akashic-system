import type { Tick } from "@akashic/playlog";
import type { StartPoint } from "@akashic/amflow";
import type { GetTicksQuery, GetStartPointsQuery, ExcludeEventFlags } from "./PlaylogActiveStore/IPlaylogActiveStore";

export interface IPlaylogStore {
	/**
	 * tickを追記する
	 */
	putTick(playId: string, tick: Tick, excludeEventFlags?: ExcludeEventFlags): Promise<void>;

	/**
	 * startPointを追記する
	 */
	putStartPoint(playId: string, startPoint: StartPoint): Promise<void>;

	/**
	 * 追記済みのtickを更新する
	 */
	updateTick(playId: string, tick: Tick): Promise<void>;

	/**
	 * tickを取得する
	 */
	getTick(playId: string, frame: number, excludeEventFlags?: ExcludeEventFlags): Promise<Tick | null>;

	/**
	 * tick一覧を取得する
	 */
	getTicks(query: GetTicksQuery): Promise<Tick[]>;

	/**
	 * tick一覧を取得する(raw版)
	 */
	getTicksRaw(query: GetTicksQuery): Promise<Buffer[]>;

	/**
	 * startPointを取得する
	 */
	getStartPoint(playId: string, frame: number): Promise<StartPoint | null>;

	/**
	 * startPoint一覧を取得する
	 */
	getStartPoints(query: GetStartPointsQuery): Promise<StartPoint[]>;

	/**
	 * 指定したフレームに一番近いstartPointを取得する
	 */
	getClosestStartPoint(playId: string, frame: number): Promise<StartPoint | null>;

	/**
	 * 指定したtimestamp未満の一番近いstartPointを取得する
	 */
	getClosestStartPointByTimestamp(playId: string, timestamp: number): Promise<StartPoint | null>;

	/**
	 * 最終アクセス日時を更新する
	 */
	updateLastAccessTime(playId: string): Promise<void>;

	/**
	 * アーカイブを作成する
	 */
	createArchive(playId: string): Promise<void>;

	/**
	 * アーカイブ作成済みでアクティブにデータが残っているプレイのうち、アクティブの物を消す
	 */
	pruneActive(playId: string): Promise<void>;
}
