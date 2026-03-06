import { SystemApiClient } from "@akashic/system-api-client";
import { Request, Response } from "express";
import { limit } from "../../../share/constants";
import { BaseURL, CreatePagenationInfo } from "../../../utils/Page";
import { escapeElasticsearchSpecialChars } from "../../../utils/Url";

// 外部からはテストでのみ使用されることを想定しています
export function createSearchParameter(query: any, page: number) {
	const searchCondition: any = { report_type: "crash" };
	["file", "instanceId", "message", "tag", "level", "logger"].forEach((allowCondition) => {
		if (query[allowCondition]) {
			searchCondition[allowCondition] = escapeElasticsearchSpecialChars(global.decodeURI(query[allowCondition]));
		}
	});

	const searchParam: any = {
		condition: JSON.stringify(searchCondition),
		sort: "-ts",
		_offset: limit * (page - 1),
		_limit: limit,
		_count: 1,
	};

	["since", "until"].forEach((allowParam) => {
		if (query[allowParam]) {
			searchParam[allowParam] = global.decodeURI(query[allowParam]);
		}
	});

	return searchParam;
}

export class ReportsController {
	private _systemApiClient: SystemApiClient;

	constructor(systemApiClient: SystemApiClient) {
		this._systemApiClient = systemApiClient;
	}

	public get(req: Request, res: Response, next: Function) {
		const page = Number(req.query.page) || 1;
		const searchParam = createSearchParameter(req.query, page);

		return this._systemApiClient
			.findReports(searchParam)
			.then((res) => res.data)
			.then((data) => {
				return res.render(
					"reports",
					(Object as any).assign(
						{
							reports: data.values,
							base: BaseURL(req.query as any), // おそらく間違った実装だが、元々これで動いており正しい実装・意図がわからないため、型エラーを握りつぶしてコンパイルを通す
							totalCount: data.totalCount || 0,
							helpers: {
								trim: (message: string, len: number) => {
									if (message && message.length > len) {
										return message.substr(0, len - 3) + "...";
									}
									return message;
								},
							},
						},
						CreatePagenationInfo(Math.ceil(data.totalCount / limit), page),
					),
				);
			})
			.catch((error) => next(error));
	}
}
