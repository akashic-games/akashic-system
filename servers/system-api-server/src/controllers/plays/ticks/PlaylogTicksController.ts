import * as restCommons from "@akashic/akashic-rest-commons";
import * as Cast from "@akashic/cast-util";
import * as playlog from "@akashic/playlog";
import * as express from "express";

import PlaylogApiServerService from "../../../domain/services/PlaylogApiServerService";
import * as ErrorConverters from "../../../utils/ErrorConverters";

export default class PlaylogTicksController {
	private _playLogEventClient: PlaylogApiServerService;

	constructor(playLogEvent: PlaylogApiServerService) {
		this._playLogEventClient = playLogEvent;
	}

	/**
	 * プレーログ tick データの送信
	 * POST /v1.0/plays/:playId/ticks
	 */
	public post(req: express.Request, res: express.Response, next: Function): any {
		let id: string;
		try {
			id = Cast.bigint(req.params.playId, false, "invalid play id");
		} catch (error) {
			return next(new restCommons.Errors.InvalidParameter("invalid parameter", error));
		}
		const tick: playlog.Tick = req.body.tick;
		if (!Array.isArray(tick)) {
			return next(new restCommons.Errors.InvalidParameter("invalid parameter", "tick data is not valid"));
		}
		this._playLogEventClient
			.putTick(id, tick)
			.then(res.json)
			.catch((error: any) => ErrorConverters.restClientErrorToApiError(error))
			.catch((error: any) => next(error));
	}

	public async put(req: express.Request, res: express.Response, next: Function): Promise<any> {
		let id: string;
		try {
			id = Cast.bigint(req.params.playId, false, "invalid play id");
		} catch (error) {
			return next(new restCommons.Errors.InvalidParameter("invalid parameter", error));
		}
		const tick: playlog.Tick = req.body.tick;
		if (!Array.isArray(tick)) {
			return next(new restCommons.Errors.InvalidParameter("invalid parameter", "tick data is not valid"));
		}
		try {
			await this._playLogEventClient.updateTick(id, tick);
			await this._playLogEventClient.deleteCache(id);
			return res.json({});
		} catch (error) {
			return next(error);
		}
	}
}
