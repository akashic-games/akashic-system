import { TickIndex } from "@akashic/playlog";
import type { IPlaylogArchiveStore } from "./IPlaylogArchiveStore";
import type { Tick } from "@akashic/playlog";
import type { StartPoint } from "@akashic/amflow";

export class MemoryArchiveStore implements IPlaylogArchiveStore {
	readonly ticks = new Map<string, { original: Map<number, Tick>; excludedIgnorable: Map<number, Tick> }>();
	readonly startPoints = new Map<string, Map<number, StartPoint>>();
	reset() {
		this.ticks.clear();
		this.startPoints.clear();
	}

	async getAllTicks(playId: string): Promise<{ original: Tick[]; excludedIgnorable: Tick[] }> {
		const ticksMap = this.getTicksMap(playId);
		return {
			original: Array.from(ticksMap.original.values()),
			excludedIgnorable: Array.from(ticksMap.excludedIgnorable.values()),
		};
	}

	async getAllStartPoints(playId: string): Promise<StartPoint[]> {
		return Array.from(this.getStartPointsMap(playId).values());
	}

	async store(playId: string, ticks: { original: Tick[]; excludedIgnorable: Tick[] }, startPoints: StartPoint[]): Promise<void> {
		this.ticks.set(playId, {
			original: new Map(ticks.original.map((tick) => [tick[TickIndex.Frame], tick])),
			excludedIgnorable: new Map(ticks.excludedIgnorable.map((tick) => [tick[TickIndex.Frame], tick])),
		});
		this.startPoints.set(playId, new Map(startPoints.map((startPoint) => [startPoint.frame, startPoint])));
	}

	private getTicksMap(playId: string): { original: Map<number, Tick>; excludedIgnorable: Map<number, Tick> } {
		const ticks = this.ticks.get(playId);
		if (ticks) {
			return ticks;
		}

		const newTicks = { original: new Map<number, Tick>(), excludedIgnorable: new Map<number, Tick>() };
		this.ticks.set(playId, newTicks);
		return newTicks;
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
