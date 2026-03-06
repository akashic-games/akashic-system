import { PlayClient } from "@akashic/system-control-api-client";
import { Request, Response } from "express";
import { limit } from "../../../share/constants";
import { BaseURL, CreatePagenationInfo } from "../../../utils/Page";

export class PlaysController {
	private _client: PlayClient;

	constructor(playClient: PlayClient) {
		this._client = playClient;
	}

	public get(req: Request, res: Response, next: Function) {
		const page = Number(req.query.page) || 1;
		const param: { [key: string]: any } = {};
		const keys = Object.keys(req.query);
		for (let i = 0; i < keys.length; i++) {
			param[keys[i]] = global.decodeURI(req.query[keys[i]] as string);
		}
		param._offset = limit * (page - 1);
		param._limit = limit;
		param._count = 1;
		this._client
			.getPlays(param as any)
			.then((res) => res.data)
			.then((data: any) => {
				return res.render(
					"plays",
					Object.assign(
						{
							plays: data.values,
							base: BaseURL(req.query as any),
							totalCount: data.totalCount || 0,
						},
						CreatePagenationInfo(Math.ceil(data.totalCount / limit), page),
					),
				);
			})
			.catch((error) => next(error));
	}
}
