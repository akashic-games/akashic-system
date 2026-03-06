import * as lu from "@akashic/log-util";
import * as engine from "@akashic/playlog-server-engine";
import { ServerEngineAMFlow } from "./ServerEngineAMFlow";

import { EventLimitCount } from "./EventLimitCount";
import { Handlers } from "./Handlers";

export class ServerEngineFactory implements engine.Factory {
	private _handlers: Handlers;
	private _eventLimitCount: EventLimitCount;
	private _logger: lu.LogUtil;
	constructor(handlers: Handlers, logger: lu.LogUtil, eventLimitCount: EventLimitCount) {
		this._handlers = handlers;
		this._logger = logger;
		this._eventLimitCount = eventLimitCount;
	}
	public createAMFlow(session: engine.Session): engine.AMFlowLike {
		return new ServerEngineAMFlow(this._handlers, this._logger, this._eventLimitCount, session);
	}
}
