import { Errors } from "@akashic/akashic-rest-commons";
import * as Cast from "@akashic/cast-util";
import ErrorConverters = require("../../utils/ErrorConverters");
import ProcessesRequest = require("./ProcessesRequest");
import type { Request, Response } from "express";
import type { ProcessService } from "../../services/ProcessService";

class ProcessesController {
	private _processService: ProcessService;

	constructor(processService: ProcessService) {
		this._processService = processService;
	}

	public get(req: Request, res: Response, next: Function): any {
		const getParams: ProcessesRequest = {};
		try {
			getParams._offset = Cast.rangeInt(req.query._offset, 0, 999, true, "invalid _offset");
			getParams._limit = Cast.rangeInt(req.query._limit, 0, 1000, true, "invalid _limit");
			getParams._count = Cast.rangeInt(req.query._count, 0, 1, true, "invalid _count");
			getParams.host = Cast.string(req.query.host, undefined, true, "invalid host");
			getParams.type = Cast.string(req.query.type, undefined, true, "invalid type");
		} catch (error) {
			return next(new Errors.InvalidParameter("invalid parameter", error));
		}
		this._processService
			.find(getParams)
			.then(res.json)
			.catch((error) => ErrorConverters.restClientErrorToApiError(error))
			.catch((error) => next(error));
	}

	public put(req: Request, res: Response, next: Function): any {
		try {
			const host = Cast.string(req.query.host, undefined, true, "invalid host");
			const mode = Cast.string(req.query.mode, undefined, true, "invalid mode");
			this._processService
				.changeProcessesMode(host, mode)
				.then(res.json)
				.catch((error) => next(error));
		} catch (error) {
			return next(new Errors.InvalidParameter("invalid parameter", error));
		}
	}
}
export = ProcessesController;
