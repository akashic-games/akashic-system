export type PlaylogStoreErrorType = "notFound" | "badRequest" | "tickConflict" | "startPointConflict" | "metadataConflict" | "other";

export class PlaylogStoreError extends Error {
	readonly playId: string;
	readonly errorType: PlaylogStoreErrorType;
	readonly cause: Error | undefined;
	constructor(message: string, playId: string, errorType: PlaylogStoreErrorType, cause?: Error) {
		super(message + (cause ? ` caused by: ${cause.name} ${cause.message}` : ""));
		this.playId = playId;
		this.errorType = errorType;
		this.cause = cause;
	}
}
