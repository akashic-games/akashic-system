import * as restCommons from "@akashic/akashic-rest-commons";
import * as Cast from "@akashic/cast-util";
import * as express from "express";
import PlayServerService from "../../domain/services/PlayServerService";
import * as ErrorConverters from "../../utils/ErrorConverters";

export default class PlayController {
	private client: PlayServerService;

	constructor(play: PlayServerService) {
		this.client = play;
	}

	/**
	 * プレー取得
	 * GET /v1.0/plays/:playId
	 */
	public get(req: express.Request, res: express.Response, next: Function): any {
		let id: string;

		try {
			id = Cast.bigint(req.params.playId, false, "invalid play id");
		} catch (error) {
			return next(new restCommons.Errors.InvalidParameter("invalid parameter", error));
		}

		this.client
			.getPlay(id)
			.then(res.json)
			.catch((error: any) => ErrorConverters.restClientErrorToApiError(error))
			.catch((error: any) => next(error));
	}

	/**
	 * プレー状態変更
	 * PATCH /v1.0/plays/:playId
	 */
	public patch(req: express.Request, res: express.Response, next: Function): any {
		let id: string;
		let status: string;

		try {
			id = Cast.bigint(req.params.playId, false, "invalid play id");
			status = Cast.string(req.body.status, 32, false, "status is not valid.");
		} catch (error) {
			return next(new restCommons.Errors.InvalidParameter("invalid parameter", error));
		}

		this.client
			.patchPlay(id, { status })
			.then(res.json)
			.catch((error: any) => ErrorConverters.restClientErrorToApiError(error))
			.catch((error: any) => next(error));
	}

	/**
	 * プレー停止
	 * DELETE /v1.0/plays/:playId
	 */
	public delete(req: express.Request, res: express.Response, next: Function): any {
		let id: string;

		try {
			id = Cast.bigint(req.params.playId, false, "invalid play id");
		} catch (error) {
			return next(new restCommons.Errors.InvalidParameter("invalid parameter", error));
		}

		this.client
			.stopPlay(id)
			.then(res.json)
			.catch((error: any) => ErrorConverters.restClientErrorToApiError(error))
			.catch((error: any) => next(error));
	}
}
