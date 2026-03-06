import { PlaylogStoreError } from "./PlaylogStoreError";
import type { Tick } from "@akashic/playlog";
import { ExcludeEventFlags } from ".";

export class PlaylogStoreTickConflictError extends PlaylogStoreError {
	readonly receivedTick: Tick;
	readonly excludeEventFlags: ExcludeEventFlags | undefined;
	constructor(message: string, playId: string, receivedTick: Tick, excludeEventFlags: ExcludeEventFlags | undefined, cause?: Error) {
		super(message, playId, "tickConflict", cause);
		this.receivedTick = receivedTick;
		this.excludeEventFlags = excludeEventFlags;
	}
}
