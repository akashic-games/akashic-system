import * as restCommons from "@akashic/akashic-rest-commons";
import * as Cast from "@akashic/cast-util";
import * as dt from "@akashic/server-engine-data-types";
import * as express from "express";
import PermissionServerService from "../../../../domain/services/PermissionServerService";
import PlayServerService from "../../../../domain/services/PlayServerService";
import * as ErrorConverters from "../../../../utils/ErrorConverters";

export default class PlayTokenPurgeController {
	private client: PermissionServerService;
	private playClient: PlayServerService;

	constructor(client: PermissionServerService, playClient: PlayServerService) {
		this.client = client;
		this.playClient = playClient;
	}

	/**
	 * プレートークン削除
	 * DELETE /v1.0/plays/:playId/tokens/purge
	 */
	public delete(req: express.Request, res: express.Response, next: Function): any {
		let playId: string;
		let tokenValue: string;
		try {
			playId = Cast.bigint(req.params.playId, false, "invalid play id");
			tokenValue = Cast.uriUnreserved(req.body.value, undefined, false, "invalid token value");
		} catch (error) {
			return next(new restCommons.Errors.InvalidParameter("invalid parameter", error));
		}

		this.playClient
			.getPlay(playId)
			.then((play: dt.Play) => {
				if (!play) {
					return Promise.reject<void>(new restCommons.Errors.NotFound("play not found"));
				} else {
					return this.client.deleteToken(playId, tokenValue);
				}
			})
			.then(res.json)
			.catch((error: any) => ErrorConverters.restClientErrorToApiError(error))
			.catch((error: any) => next(error));
	}
}
