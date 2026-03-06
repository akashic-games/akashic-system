import * as restCommons from "@akashic/akashic-rest-commons";
import * as Cast from "@akashic/cast-util";
import * as express from "express";
import { LogUtil } from "@akashic/log-util";
import * as log4js from "log4js";

import PlaylogApiServerService from "../../../domain/services/PlaylogApiServerService";
import * as ErrorConverters from "../../../utils/ErrorConverters";

export default class PlaylogEventsController {
	private _playLogEventClient: PlaylogApiServerService;

	constructor(playLogEvent: PlaylogApiServerService) {
		this._playLogEventClient = playLogEvent;
	}

	/**
	 * プレーイベント通知
	 * POST /v1.0/plays/:playId/events
	 */
	public post(req: express.Request, res: express.Response, next: Function): any {
		let id: string;
		let type: string;
		// LoggerAwareがExpressのControllerだと機能しないようなので、LogUtilを利用しています
		const logger = new LogUtil(log4js.getLogger("out"));

		try {
			id = Cast.bigint(req.params.playId, false, "invalid play id");
			type = Cast.string(req.body.type, 128, false, "type is not valid");
		} catch (error) {
			return next(new restCommons.Errors.InvalidParameter("invalid parameter", error));
		}

		const values: any = req.body.values;
		if (!values || Array.isArray(values) || typeof values !== "object") {
			return next(new restCommons.Errors.InvalidParameter("invalid parameter", "values is not valid"));
		}
		const eventType = type === "Message" ? values?.event.type : type;
		if (eventType === "ExternalModuleResult") {
			logger.warn(`refs issues/346. post plays/events. playId: ${id}. type: ${eventType}. values: ${JSON.stringify(values)}`);
		} else {
			logger.warn(`refs issues/2697. post plays/events. playId: ${id}. type: ${eventType}`);
		}
		this._playLogEventClient
			.createEvent(id, { type, values })
			.then(() => res.json(undefined))
			.catch((error: any) => ErrorConverters.restClientErrorToApiError(error))
			.catch((error: any) => next(error));
	}
}
