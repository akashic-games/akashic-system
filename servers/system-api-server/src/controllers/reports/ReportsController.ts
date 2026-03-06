import * as restCommons from "@akashic/akashic-rest-commons";
import * as Cast from "@akashic/cast-util";
import * as express from "express";
import InstanceServerService from "../../domain/services/InstanceServerService";
import * as ErrorConverters from "../../utils/ErrorConverters";

export class ReportsController {
	private _client: InstanceServerService;

	constructor(client: InstanceServerService) {
		this._client = client;
	}

	/**
	 * レポート一覧
	 * GET /v1.0/reports
	 */
	public get(req: express.Request, res: express.Response, next: Function): any {
		let getParams: any;
		try {
			getParams = {
				_offset: Cast.int(req.query._offset, true, "invalid _offset"),
				_limit: Cast.int(req.query._limit, true, "invalid _limit"),
				_sort: Cast.string(req.query._sort, undefined, true, "invalid _sort"),
				condition: Cast.string(req.query.condition, undefined, true, "invalid condition"),
				since: Cast.date(req.query.since, true, "invalid since"),
				until: Cast.date(req.query.until, true, "invalid until"),
			};
			Object.keys(getParams).forEach((key: string) => {
				if (getParams[key] === undefined) {
					delete getParams[key];
				}
			});
			if (getParams._offset && getParams._offset < 0) {
				throw new TypeError("invalid _offset");
			}
			if (getParams._limit && (getParams._limit < 0 || getParams._limit > 100)) {
				throw new TypeError("invalid _limit");
			}
		} catch (error) {
			return next(new restCommons.Errors.InvalidParameter("invalid parameter", error));
		}
		this._client
			.getReports(getParams)
			.then(res.json)
			.catch((error: any) => ErrorConverters.restClientErrorToApiError(error))
			.catch((error: any) => next(error));
	}
}
