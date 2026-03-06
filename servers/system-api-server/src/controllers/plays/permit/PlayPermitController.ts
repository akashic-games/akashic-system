import * as restCommons from "@akashic/akashic-rest-commons";
import * as CastUtil from "@akashic/cast-util";
import { PlayTokenPermissionLike } from "@akashic/server-engine-data-types";
import * as express from "express";
import PermissionServerService from "../../../domain/services/PermissionServerService";
import { restClientErrorToApiError } from "../../../utils/ErrorConverters";

export default class PlayPermitController {
	private client: PermissionServerService;

	constructor(client: PermissionServerService) {
		this.client = client;
	}

	/**
	 * プレー権限更新
	 * PUT /v1.0/plays/permit
	 */
	public async put(req: express.Request, res: express.Response, next: Function): Promise<void> {
		let playId: string;
		let userId: string;
		let tokenValue: string;
		let permission: PlayTokenPermissionLike;
		try {
			permission = this.client.toPlayTokenPermission(req.body.permission);
			playId = CastUtil.bigint(req.body.playId, true, "invalid play id");
			userId = CastUtil.string(req.body.userId, PermissionServerService.limitUserIdLength, true, "invalid user id");
			tokenValue = CastUtil.uriUnreserved(req.body.tokenValue, undefined, true, "invalid token value");
		} catch (error) {
			next(new restCommons.Errors.InvalidParameter("invalid parameter", error));
			return;
		}

		try {
			await this.client.updatePermission(permission, { playId, userId, tokenValue });
			res.json();
		} catch (error) {
			const apiError = await restClientErrorToApiError(error);
			next(apiError);
		}
	}
}
