import * as restCommons from "@akashic/akashic-rest-commons";
import * as Cast from "@akashic/cast-util";
import * as dt from "@akashic/server-engine-data-types";
import * as express from "express";
import InstanceServerService from "../../../domain/services/InstanceServerService";
import InstancesResponse from "../../../responses/InstancesResponse";
import * as ErrorConverters from "../../../utils/ErrorConverters";

export default class InstancesController {
	private _instanceClient: InstanceServerService;

	constructor(instanceClient: InstanceServerService) {
		this._instanceClient = instanceClient;
	}

	/**
	 * プレー内インスタンス一覧取得
	 * GET /v1.0/plays/:playId/instances
	 */
	public get(req: express.Request, res: express.Response, next: Function): any {
		let playId: string;

		try {
			playId = Cast.bigint(req.params.playId, false, "invalid play id");
		} catch (error) {
			return next(new restCommons.Errors.InvalidParameter("invalid parameter", error));
		}

		this._instanceClient
			.getInstancesByPlayId(playId)
			// @ts-ignore
			.then((response: dt.PagingResponse<dt.Instance>) => InstancesResponse.fromDomainAndClient(response.values, response.totalCount))
			.then(res.json)
			.catch((error: any) => ErrorConverters.restClientErrorToApiError(error))
			.catch((error: any) => next(error));
	}
}
