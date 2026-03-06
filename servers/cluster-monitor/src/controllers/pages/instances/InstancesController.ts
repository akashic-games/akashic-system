import { ProcessClient } from "@akashic/cluster-monitor-api-client";
import { InstanceClient } from "@akashic/system-control-api-client";
import { Request, Response } from "express";
import { limit } from "../../../share/constants";
import { BaseURL, CreatePagenationInfo } from "../../../utils/Page";

export class InstancesController {
	private _instanceClient: InstanceClient;
	private _processClient: ProcessClient;

	constructor(instanceClient: InstanceClient, processClient: ProcessClient) {
		this._instanceClient = instanceClient;
		this._processClient = processClient;
	}

	public get(req: Request, res: Response, next: Function) {
		let promise: Promise<any>;
		const page = Number(req.query.page) || 1;
		const fromPlay = req.query.play !== undefined;
		const fromProcess = req.query.process !== undefined;
		if (fromProcess) {
			return this._processClient
				.getInstances(req.query.process as string)
				.then((res) => res.data)
				.then((data) => {
					return res.render("instances", {
						instances: data,
					});
				})
				.catch((error) => next(error));
		}
		if (fromPlay) {
			promise = this._instanceClient.getInstancesByPlayId(req.query.play as string);
		} else {
			const param: { [key: string]: any } = {};
			const keys = Object.keys(req.query);
			for (let i = 0; i < keys.length; i++) {
				param[keys[i]] = global.decodeURI(req.query[keys[i]] as string);
			}
			param._offset = limit * (page - 1);
			param._limit = limit;
			param._count = 1;
			promise = this._instanceClient.findInstances(param);
		}
		promise
			.then((res) => res.data)
			.then((data) => {
				return res.render(
					"instances",
					Object.assign(
						{
							instances: data.values,
							base: BaseURL(req.query as any), // おそらく間違った実装だが、元々これで動いており正しい実装・意図がわからないため、型エラーを握りつぶしてコンパイルを通す
							totalCount: data.totalCount || 0,
						},
						CreatePagenationInfo(Math.ceil(data.totalCount / limit), page),
					),
				);
			})
			.catch((error) => next(error));
	}
}
