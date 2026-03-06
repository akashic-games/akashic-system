import type { Tick, Event } from "@akashic/playlog";
import type { StartPoint } from "@akashic/amflow";

export type EventMessageCallback = (playId: string, event: Event, rawData: Buffer) => Promise<void>;
export type TickMessageCallback = (playId: string, tick: Tick, rawData: Buffer) => Promise<void>;
export type StartPointMessageCallback = (playId: string, startPoint: StartPoint, rawData: Buffer) => Promise<void>;

export type PlaylogQueueCallback = {
	onEventMessage?: EventMessageCallback;
	onTickMessage?: TickMessageCallback;
	onStartPointMessage?: StartPointMessageCallback;
};

export interface IPlaylogQueue {
	start(): Promise<void>;
	stop(): Promise<void>;
	subscribe(playId: string, callback: PlaylogQueueCallback): Promise<void>;
	unsubscribe(playId: string): Promise<void>;
}

export type DeadLetterQueueCallback = {
	onTickMessage: TickMessageCallback;
	onStartPointMessage: StartPointMessageCallback;
};

export interface IPlaylogStoreQueue extends IPlaylogQueue {
	subscribeDeadLetter(callbacks: DeadLetterQueueCallback): Promise<void>;
	hasMessage(playId: string): Promise<boolean | null>;
	deleteQueue(playId: string): Promise<void>;
}
