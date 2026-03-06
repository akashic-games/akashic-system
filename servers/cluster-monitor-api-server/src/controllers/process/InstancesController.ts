import { Errors } from "@akashic/akashic-rest-commons";
import * as Cast from "@akashic/cast-util";
import ErrorConverters = require("../../utils/ErrorConverters");
import type { Request, Response } from "express";
import type { InstanceService } from "../../services/InstanceService";

class InstancesController {
	private _instanceService: InstanceService;

	constructor(instanceService: InstanceService) {
		this._instanceService = instanceService;
	}

	public get(req: Request, res: Response, next: Function): any {
		let processName: string;
		try {
			processName = Cast.string(req.params.processName, undefined, false, "invalid processName");
		} catch (error) {
			return next(new Errors.InvalidParameter("invalid parameter", error));
		}
		this._instanceService
			.getByName(processName)
			.then(res.json)
			.catch((error) => ErrorConverters.restClientErrorToApiError(error))
			.catch((error) => next(error));
	}
}
export = InstancesController;
