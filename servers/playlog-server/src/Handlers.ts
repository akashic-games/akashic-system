import { PlaylogHandler } from "./PlaylogHandler";
import { PlayTokenValidator } from "./PlayTokenValidator";
import { RequestHandler } from "./RequestHandler";
import { SystemControlAPIHandler } from "./SystemControlAPIHandler";

export interface Handlers {
	playlog: PlaylogHandler;
	request: RequestHandler;
	systemControlAPI: SystemControlAPIHandler;
	playTokenValidator: PlayTokenValidator;
}
