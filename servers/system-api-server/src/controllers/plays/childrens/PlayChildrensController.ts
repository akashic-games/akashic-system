import * as restCommons from "@akashic/akashic-rest-commons";
import { PlayRelationModel } from "@akashic/akashic-system";
import * as Cast from "@akashic/cast-util";
import * as express from "express";
import * as ErrorConverters from "../../../utils/ErrorConverters";

export default class PlayChildrensController {
	private client: PlayRelationModel;

	constructor(play: PlayRelationModel) {
		this.client = play;
	}

	/**
	 * プレーの親子関係を作成する
	 * POST /v1.0/plays/:playId/children
	 */
	public post(req: express.Request, res: express.Response, next: Function): any {
		let playId: string;
		let childId: string;
		let allow: any;
		let deny: any;
		let authorizedFlag: string;
		try {
			playId = Cast.bigint(req.params.playId, false, "invalid playId");
			childId = Cast.bigint(req.body.childId, false, "invliad childId");
			allow = req.body.allow; // validation は play-server に任せる
			deny = req.body.deny; // validation は play-server に任せる
			authorizedFlag = Cast.string(req.body.authorizedFlag, undefined, true, "invalid authorizedFlag");
		} catch (error) {
			return next(new restCommons.Errors.InvalidParameter("invalid parameter", error));
		}

		this.client
			.store(playId, childId, {
				allow: allow != null ? allow : undefined,
				deny: deny != null ? deny : undefined,
				authorizedFlag: authorizedFlag != null ? authorizedFlag : undefined,
			})
			.then(() => res.json())
			.catch((error: any) => ErrorConverters.restClientErrorToApiError(error))
			.catch((error: any) => next(error));
	}
}
