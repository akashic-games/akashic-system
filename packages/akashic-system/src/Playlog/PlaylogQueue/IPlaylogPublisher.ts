import type { Tick, Event } from "@akashic/playlog";
import type { StartPoint } from "@akashic/amflow";

export interface IPlaylogPublisher {
	start(): Promise<void>;
	stop(): Promise<void>;
	prepare(playId: string): Promise<void>;
	cleanup(playId: string): Promise<void>;
	publishTick(playId: string, tick: Tick): Promise<void>;
	publishStartPoint(playId: string, startPoint: StartPoint): Promise<void>;
	publishEvent(playId: string, event: Event): Promise<void>;
}
