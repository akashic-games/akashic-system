import * as restCommons from "@akashic/akashic-rest-commons";
import { PlayRelationModel } from "@akashic/akashic-system";
import * as Cast from "@akashic/cast-util";
import * as express from "express";
import * as ErrorConverters from "../../../utils/ErrorConverters";

export default class PlayChildrenController {
	private client: PlayRelationModel;

	constructor(play: PlayRelationModel) {
		this.client = play;
	}

	/**
	 * プレーの親子関係を削除する
	 * DELETE /v1.0/plays/:playId/children/:childId
	 */
	public delete(req: express.Request, res: express.Response, next: Function): any {
		let playId: string;
		let childId: string;
		try {
			playId = Cast.bigint(req.params.playId, false, "invalid playId");
			childId = Cast.bigint(req.params.childId, false, "invalid childId");
		} catch (error) {
			return next(new restCommons.Errors.InvalidParameter("invalid parameter", error));
		}
		this.client
			.destroy(playId, childId)
			.then(() => res.json())
			.catch((error: any) => ErrorConverters.restClientErrorToApiError(error))
			.catch((error: any) => next(error));
	}
}
