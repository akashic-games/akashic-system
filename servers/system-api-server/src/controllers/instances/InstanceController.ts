import * as restCommons from "@akashic/akashic-rest-commons";
import * as Cast from "@akashic/cast-util";
import * as dt from "@akashic/server-engine-data-types";
import * as express from "express";
import InstanceServerService from "../../domain/services/InstanceServerService";
import InstanceResponse from "../../responses/InstanceResponse";
import * as ErrorConverters from "../../utils/ErrorConverters";

export default class InstanceController {
	private _instanceClient: InstanceServerService;
	constructor(instanceClient: InstanceServerService) {
		this._instanceClient = instanceClient;
	}

	/**
	 * インスタンス取得
	 * GET /v1.0/instances/:instanceId
	 */
	public get(req: express.Request, res: express.Response, next: Function): any {
		let id: string;
		try {
			id = Cast.bigint(req.params.instanceId, false, "invalid instance id");
		} catch (error) {
			return next(new restCommons.Errors.InvalidParameter("invalid parameter", error));
		}
		this._instanceClient
			.getInstance(id)
			.then((instance: dt.Instance) => InstanceResponse.fromDomain(instance))
			.then(res.json)
			.catch((error: any) => ErrorConverters.restClientErrorToApiError(error))
			.catch((error: any) => next(error));
	}

	/**
	 * インスタンス停止
	 * DELETE /v1.0/instances/:instanceId
	 */
	public delete(req: express.Request, res: express.Response, next: Function): any {
		let id: string;
		try {
			id = Cast.bigint(req.params.instanceId, false, "invalid instance id");
		} catch (error) {
			return next(new restCommons.Errors.InvalidParameter("invalid parameter", error));
		}
		this._instanceClient
			.deletetInstance(id)
			.then(res.json)
			.catch((error: any) => ErrorConverters.restClientErrorToApiError(error))
			.catch((error: any) => next(error));
	}

	/**
	 * インスタンス状態変更
	 * PATCH /v1.0/instances/:instanceId
	 */
	public patch(req: express.Request, res: express.Response, next: Function): any {
		let id: string;
		let status: string;
		try {
			id = Cast.bigint(req.params.instanceId, false, "invalid instance id");
			status = Cast.string(req.body.status, 32, false, "invalid status");
		} catch (error) {
			return next(new restCommons.Errors.InvalidParameter("invalid parameter", error));
		}

		let task: Promise<dt.Instance>;
		if (status === dt.Constants.INSTANCE_STATE_PAUSED || status === dt.Constants.INSTANCE_STATE_PAUSING) {
			task = this._instanceClient.pauseInstance(id);
		} else if (status === dt.Constants.INSTANCE_STATE_RUNNING || status === dt.Constants.INSTANCE_STATE_RESUMING) {
			task = this._instanceClient.resumeInstance(id);
		} else {
			task = Promise.reject(new restCommons.Errors.InvalidParameter(`status ${status} is not valid`));
		}

		task
			.then(res.json)
			.catch((error: any) => ErrorConverters.restClientErrorToApiError(error))
			.catch((error: any) => next(error));
	}
}
