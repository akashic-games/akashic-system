import { PlaylogStoreError } from "./PlaylogStoreError";
import type { StartPoint } from "@akashic/amflow";

export class PlaylogStoreStartPointConflictError extends PlaylogStoreError {
	readonly receivedStartPoint: StartPoint;
	constructor(message: string, playId: string, receivedStartPoint: StartPoint, cause?: Error) {
		super(message, playId, "startPointConflict", cause);
		this.receivedStartPoint = receivedStartPoint;
	}
}
