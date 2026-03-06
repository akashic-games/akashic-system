import * as restCommons from "@akashic/akashic-rest-commons";
import * as Cast from "@akashic/cast-util";
import * as express from "express";

import PlaylogApiServerService from "../../../domain/services/PlaylogApiServerService";
import * as ErrorConverters from "../../../utils/ErrorConverters";

export default class StartPointsController {
	private _playLogEventClient: PlaylogApiServerService;

	constructor(playLogEvent: PlaylogApiServerService) {
		this._playLogEventClient = playLogEvent;
	}

	/**
	 * start point データの送信
	 * POST /v1.0/plays/:playId/startpoints
	 */
	public post(req: express.Request, res: express.Response, next: Function): any {
		let id: string;
		try {
			id = Cast.bigint(req.params.playId, false, "invalid play id");
		} catch (error) {
			return next(new restCommons.Errors.InvalidParameter("invalid parameter", error));
		}
		const startPoint: any = req.body.startPoint;
		if (typeof startPoint !== "object") {
			return next(new restCommons.Errors.InvalidParameter("invalid parameter", "startPoint data is not valid"));
		}
		this._playLogEventClient
			.putStartPoint(id, startPoint)
			.then(res.json)
			.catch((error: any) => ErrorConverters.restClientErrorToApiError(error))
			.catch((error: any) => next(error));
	}
}
