import { Errors } from "@akashic/akashic-rest-commons";
import * as Cast from "@akashic/cast-util";
import ErrorConverters = require("../../utils/ErrorConverters");
import type { Request, Response } from "express";
import type { ProcessService } from "../../services/ProcessService";

class ProcessController {
	private _processService: ProcessService;

	constructor(processService: ProcessService) {
		this._processService = processService;
	}

	public get(req: Request, res: Response, next: Function): any {
		let processName: string;
		try {
			processName = Cast.string(req.params.processName, undefined, false, "invalid processName");
		} catch (error) {
			return next(new Errors.InvalidParameter("invalid parameter", error));
		}
		this._processService
			.getProcessFromName(processName)
			.then(res.json)
			.catch((error) => ErrorConverters.restClientErrorToApiError(error))
			.catch((error) => next(error));
	}

	public put(req: Request, res: Response, next: Function): any {
		let processName: string;
		try {
			processName = Cast.string(req.params.processName, undefined, false, "invalid processName");
		} catch (error) {
			return next(new Errors.InvalidParameter("invalid parameter", error));
		}
		this._processService
			.changeProcessMode(processName, req.body.mode)
			.then(res.json)
			.catch((error) => ErrorConverters.restClientErrorToApiError(error))
			.catch((error) => next(error));
	}
}
export = ProcessController;
