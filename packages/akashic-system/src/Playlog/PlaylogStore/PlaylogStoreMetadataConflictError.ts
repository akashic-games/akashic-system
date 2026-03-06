import { PlaylogStoreError } from "./PlaylogStoreError";

export class PlaylogStoreMetadataConflictError extends PlaylogStoreError {
	constructor(message: string, playId: string, cause?: Error) {
		super(message, playId, "metadataConflict", cause);
	}
}
