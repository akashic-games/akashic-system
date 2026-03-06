import * as restCommons from "@akashic/akashic-rest-commons";
import * as Cast from "@akashic/cast-util";
import * as dt from "@akashic/server-engine-data-types";
import * as express from "express";
import * as errors from "../errors";
import { InstanceManager } from "../master/controls/InstanceManager";

export class InstanceController {
	private _instanceManager: InstanceManager;
	constructor(instanceManager: InstanceManager) {
		this._instanceManager = instanceManager;
	}

	/**
	 * インスタンスの状態を変更する
	 * PATCH /v1.0/instances/:id
	 *   status:
	 *     "running": インスタンス起動
	 *     "closing": インスタンス停止
	 */
	public patch(req: express.Request, res: express.Response, next: Function): any {
		let id: string;
		let status: string;
		try {
			id = Cast.bigint(req.params.id, false, "invalid id");
			status = Cast.string(req.body.status, 32, false, "invalid status");
		} catch (errors) {
			return next(new restCommons.Errors.InvalidParameter("invalid parameter", errors));
		}
		let process: Promise<dt.Instance>;
		if (status === dt.Constants.INSTANCE_STATE_RUNNING) {
			process = this._instanceManager.boot(id);
		} else if (status === dt.Constants.INSTANCE_STATE_CLOSING) {
			process = this._instanceManager.shutdown(id);
		} else {
			return next(new restCommons.Errors.InvalidParameter("invalid status: " + status));
		}
		process.then(res.json).catch((err) => {
			// 起こりうるエラーをrestCommonsのエラーに変更
			if (err instanceof errors.ApplicationError) {
				switch ((err as errors.ApplicationError).code) {
					case errors.ApplicationErrorCode.NOT_MASTER_ERROR:
						err = new restCommons.Errors.BadRequest(err.message, err);
						break;
					case errors.ApplicationErrorCode.DATABASE_CONFLICT_ERROR:
						err = new restCommons.Errors.Conflict(err.message, err);
						break;
					case errors.ApplicationErrorCode.NOT_FOUND:
						err = new restCommons.Errors.NotFound(err.message, err);
						break;
				}
			}
			next(err);
		});
	}
}
