import { TickIndex } from "@akashic/playlog";
import { encodeTick } from "@akashic/amflow-message";
import type { Tick } from "@akashic/playlog";
import type { StartPoint } from "@akashic/amflow";
import type { IPlaylogActiveStore, GetTicksQuery, GetStartPointsQuery, ExcludeEventFlags } from "./PlaylogActiveStore/IPlaylogActiveStore";
import type { IPlaylogArchiveStore } from "./PlaylogArchiveStore/IPlaylogArchiveStore";

export class MemoryActiveStore implements IPlaylogActiveStore, IPlaylogArchiveStore {
	readonly ticks = new Map<string, Map<number, Tick>>();
	readonly excludedIgnorableTicks = new Map<string, Map<number, Tick>>();
	readonly startPoints = new Map<string, Map<number, StartPoint>>();
	reset() {
		this.ticks.clear();
		this.excludedIgnorableTicks.clear();
		this.startPoints.clear();
	}
	async getTick(playId: string, frame: number, excludeEventFlags?: ExcludeEventFlags): Promise<Tick | null> {
		if (excludeEventFlags?.ignorable) {
			const result = this.getExcludedIgnorableTicksMap(playId).get(frame);
			if (result) {
				return result;
			}
		}
		return this.getTicksMap(playId).get(frame) ?? null;
	}

	async getTicks(query: GetTicksQuery): Promise<Tick[]> {
		const result = await this.getTicksInner(query);

		const excludeEventFlags: ExcludeEventFlags = query.excludeEventFlags ?? {};
		if (!excludeEventFlags.ignorable || result.length > 0) {
			return result;
		}

		return await this.getTicksInner({ ...query, excludeEventFlags: { ...excludeEventFlags, ignorable: false } });
	}

	private async getTicksInner(query: GetTicksQuery): Promise<Tick[]> {
		const ticks = Array.from(
			query.excludeEventFlags?.ignorable
				? this.getExcludedIgnorableTicksMap(query.playId).values()
				: this.getTicksMap(query.playId).values(),
		)
			.filter(
				(tick) =>
					(query.frameFrom === undefined || tick[TickIndex.Frame] >= query.frameFrom) &&
					(query.frameTo === undefined || tick[TickIndex.Frame] < query.frameTo),
			)
			.sort((tick1, tick2) => tick1[TickIndex.Frame] - tick2[TickIndex.Frame]);
		// limit=0の場合はlimit無し
		if (query.limit === 0) {
			return ticks;
		}
		return ticks.slice(0, query.limit);
	}

	async getTicksRaw(query: GetTicksQuery): Promise<Buffer[]> {
		const ticks = await this.getTicks(query);
		return ticks.map((tick) => encodeTick(tick));
	}

	async putTick(playId: string, tick: Tick): Promise<void> {
		this.getTicksMap(playId).set(tick[TickIndex.Frame], tick);
	}

	async updateTick(playId: string, tick: Tick): Promise<void> {
		this.getTicksMap(playId).set(tick[TickIndex.Frame], tick);
	}

	async getStartPoint(playId: string, frame: number): Promise<StartPoint | null> {
		return this.getStartPointsMap(playId).get(frame) ?? null;
	}

	async getStartPoints(query: GetStartPointsQuery): Promise<StartPoint[]> {
		const startPoints = Array.from(this.getStartPointsMap(query.playId).values()).sort(
			(startPoint1, startPoint2) => startPoint1.frame - startPoint2.frame,
		);
		// limit=0の場合はlimit無し
		if (query.limit === 0) {
			return startPoints;
		}
		return startPoints.slice(0, query.limit);
	}

	async getClosestStartPoint(playId: string, frame: number): Promise<StartPoint | null> {
		return (
			Array.from(this.getStartPointsMap(playId).values())
				.filter((startPoint) => startPoint.frame <= frame)
				.sort((startPoint1, startPoint2) => startPoint2.frame - startPoint1.frame)[0] ?? null
		);
	}

	async getClosestStartPointByTimestamp(playId: string, timestamp: number): Promise<StartPoint | null> {
		// timestamp は指定値未満を探す:
		return (
			Array.from(this.getStartPointsMap(playId).values())
				.filter((startPoint) => startPoint.timestamp < timestamp)
				.sort((startPoint1, startPoint2) => startPoint2.timestamp - startPoint1.timestamp)[0] ?? null
		);
	}

	async putStartPoint(playId: string, startPoint: StartPoint): Promise<void> {
		this.getStartPointsMap(playId).set(startPoint.frame, startPoint);
	}

	async deleteAll(playId: string): Promise<void> {
		this.ticks.delete(playId);
		this.excludedIgnorableTicks.delete(playId);

		this.startPoints.delete(playId);
	}

	async getAllTicks(playId: string): Promise<{ original: Tick[]; excludedIgnorable: Tick[] }> {
		return {
			original: Array.from(this.getTicksMap(playId).values()),
			excludedIgnorable: Array.from(this.getExcludedIgnorableTicksMap(playId).values()),
		};
	}

	async getAllStartPoints(playId: string): Promise<StartPoint[]> {
		return Array.from(this.getStartPointsMap(playId).values());
	}

	async store(playId: string, ticks: { original: Tick[]; excludedIgnorable: Tick[] }, startPoints: StartPoint[]): Promise<void> {
		this.ticks.set(playId, new Map(ticks.original.map((tick) => [tick[TickIndex.Frame], tick])));
		this.excludedIgnorableTicks.set(playId, new Map(ticks.excludedIgnorable.map((tick) => [tick[TickIndex.Frame], tick])));

		this.startPoints.set(playId, new Map(startPoints.map((startPoint) => [startPoint.frame, startPoint])));
	}

	private getTicksMap(playId: string): Map<number, Tick> {
		const ticks = this.ticks.get(playId);
		if (ticks) {
			return ticks;
		}

		const newTicks = new Map<number, Tick>();
		this.ticks.set(playId, newTicks);
		return newTicks;
	}

	private getExcludedIgnorableTicksMap(playId: string): Map<number, Tick> {
		const excludedIgnorableTicks = this.excludedIgnorableTicks.get(playId);
		if (excludedIgnorableTicks) {
			return excludedIgnorableTicks;
		}

		const newExcludedIgnorableTicks = new Map<number, Tick>();
		this.excludedIgnorableTicks.set(playId, newExcludedIgnorableTicks);
		return newExcludedIgnorableTicks;
	}

	private getStartPointsMap(playId: string): Map<number, StartPoint> {
		const startPoints = this.startPoints.get(playId);
		if (startPoints) {
			return startPoints;
		}

		const newStartPoints = new Map<number, StartPoint>();
		this.startPoints.set(playId, newStartPoints);
		return newStartPoints;
	}
}
