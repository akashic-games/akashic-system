import * as restCommons from "@akashic/akashic-rest-commons";
import * as Cast from "@akashic/cast-util";
import * as dt from "@akashic/server-engine-data-types";
import { InstanceModule } from "@akashic/server-engine-data-types";
import * as express from "express";
import InstanceServerService from "../../domain/services/InstanceServerService";
import InstanceResponse from "../../responses/InstanceResponse";
import InstancesResponse from "../../responses/InstancesResponse";
import * as ErrorConverters from "../../utils/ErrorConverters";

export default class InstancesController {
	private _instanceClient: InstanceServerService;
	constructor(instanceClient: InstanceServerService) {
		this._instanceClient = instanceClient;
	}

	/**
	 * インスタンス一覧
	 * GET /v1.0/instances
	 */
	public get(req: express.Request, res: express.Response, next: Function): any {
		let getParams: any;
		try {
			getParams = {
				_offset: Cast.int(req.query._offset, true, "invalid _offset"),
				_limit: Cast.int(req.query._limit, true, "invalid _limit"),
				_count: Cast.int(req.query._count, true, "invalid _count"),
				gameCode: Cast.string(req.query.gameCode, undefined, true, "invalid gameCode"),
				entryPoint: Cast.string(req.query.entryPoint, undefined, true, "invalid entryPoint"),
				videoPublishUri: Cast.string(req.query.videoPublishUri, undefined, true, "invalid videoPublishUri"),
				processName: Cast.string(req.query.processName, undefined, true, "invalid processName"),
			};
			Object.keys(getParams).forEach((key: string) => {
				if (getParams[key] === undefined) {
					delete getParams[key];
				}
			});
			if (!Array.isArray(req.query.status) && typeof req.query.status !== "undefined") {
				throw new Error("parameter status is not valid");
			}
			if (req.query.status) {
				getParams.status = (req.query.status as string[])
					.map((item: any, index: number) => {
						return Cast.string(item, undefined, true, `invalid status[${index}]`);
					})
					.filter((e?: string) => !!e);
			}
		} catch (error) {
			return next(new restCommons.Errors.InvalidParameter("invalid parameter", error));
		}
		if (getParams._limit === undefined) {
			getParams._limit = 10;
		}
		if (getParams._limit > 100) {
			return next(new restCommons.Errors.InvalidParameter("invalid parameter", "max _limit is 100"));
		}
		this._instanceClient
			.findInstances(getParams)
			// @ts-ignore
			.then((response: dt.PagingResponse<dt.Instance>) => InstancesResponse.fromDomainAndClient(response.values, response.totalCount))
			.then(res.json)
			.catch((error: any) => ErrorConverters.restClientErrorToApiError(error))
			.catch((error: any) => next(error));
	}

	/**
	 * インスタンス作成
	 * POST /v1.0/instances
	 */
	public post(req: express.Request, res: express.Response, next: Function): any {
		let postBody: any;
		try {
			postBody = {
				gameCode: Cast.uriUnreserved(req.body.gameCode, 64, false, "gameCode is not valid"),
				gameRevision: Cast.uriUnreserved(req.body.gameRevision, 64, true, "gameRevision is not valid"),
				entryPoint: Cast.string(req.body.entryPoint, 512, true, "entryPoint is not valid"),
				cost: Cast.int(req.body.cost, false, "cost is not valid"),
				modules: InstanceModule.fromObjects(req.body.modules),
			};
			if (req.body.assignmentConstraints) {
				const trait: string[] = [];
				if (Array.isArray(req.body.assignmentConstraints.trait)) {
					for (const traitValue of req.body.assignmentConstraints.trait) {
						trait.push(Cast.string(traitValue, undefined, false, "assignmentConstraints.trait is not valid"));
					}
				} else {
					// 後方互換のために trait が配列以外だった場合にも文字列の配列に変換して対応（後々削除して例外を投げるようにすること）
					trait.push(Cast.string(req.body.assignmentConstraints.trait, undefined, false, "assignmentConstraints.trait is not valid"));
				}

				postBody.assignmentConstraints = {
					trait,
				};
			}
			if (req.body.forceAssignTo) {
				postBody.forceAssignTo = {
					host: Cast.string(req.body.forceAssignTo.host, undefined, false, "forceAssignTo.host is not valid"),
					name: Cast.string(req.body.forceAssignTo.name, undefined, false, "forceAssignTo.name is not valid"),
				};
			}
		} catch (error) {
			return next(new restCommons.Errors.InvalidParameter("invalid parameter", error));
		}
		this._instanceClient
			.createInstance(postBody)
			.then((instance: dt.Instance) => InstanceResponse.fromDomain(instance))
			.then(res.json)
			.catch((error: any) => ErrorConverters.restClientErrorToApiError(error))
			.catch((error: any) => next(error));
	}
}
