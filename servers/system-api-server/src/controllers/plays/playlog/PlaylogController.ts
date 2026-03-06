import * as restCommons from "@akashic/akashic-rest-commons";
import * as Cast from "@akashic/cast-util";
import * as express from "express";

import PlaylogApiServerService from "../../../domain/services/PlaylogApiServerService";
import * as ErrorConverters from "../../../utils/ErrorConverters";

export default class PlaylogController {
	private client: PlaylogApiServerService;

	constructor(playlogApiClient: PlaylogApiServerService) {
		this.client = playlogApiClient;
	}

	/**
	 * プレーログ取得
	 * GET /v1.0/plays/:playId
	 */
	public get(req: express.Request, res: express.Response, next: Function): any {
		let id: string;
		let ignorable: boolean;

		try {
			id = Cast.bigint(req.params.playId, false, "invalid play id");
			ignorable = Cast.string(req.query.excluded, undefined, true) === "ignorable" ? true : false;
		} catch (error) {
			return next(new restCommons.Errors.InvalidParameter("invalid parameter", error));
		}

		this.client
			.getPlaylog(id, { ignorable })
			.then(res.json)
			.catch((error: any) => ErrorConverters.restClientErrorToApiError(error))
			.catch((error: any) => next(error));
	}
}
