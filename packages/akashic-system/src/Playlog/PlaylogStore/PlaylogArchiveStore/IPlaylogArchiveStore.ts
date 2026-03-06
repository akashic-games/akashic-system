import type { Tick } from "@akashic/playlog";
import type { StartPoint } from "@akashic/amflow";

export interface IPlaylogArchiveStore {
	getAllTicks(playId: string): Promise<{ original: Tick[]; excludedIgnorable: Tick[] }>;
	getAllStartPoints(playId: string): Promise<StartPoint[]>;

	store(playId: string, ticks: { original: Tick[]; excludedIgnorable: Tick[] }, startPoints: StartPoint[]): Promise<void>;
}
