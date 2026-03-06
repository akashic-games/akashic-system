import { bigint } from "@akashic/cast-util";
import { Method, NicoApiResponse } from "@akashic/rest-client-core";
import { PagingResponse } from "@akashic/server-engine-data-types";
import moment from "moment";
import BaseApiClient = require("./BaseApiClient");
import methodConfig = require("./config/methods");
import { GetReportsRequest } from "./DataTypes";

/**
 * Report API サーバ（現状は instance-server）にリクエストを投げるクライアント
 */
export class ReportClient extends BaseApiClient {
	private getReportsMethod: Method<PagingResponse<any>>;

	/**
	 * @param baseUrl instance-serverの基底URL
	 */
	constructor(baseUrl: string) {
		super(baseUrl);
		const methods = methodConfig.report;
		this.getReportsMethod = this.getMethod(
			methods.getReports,
			(data) =>
				new PagingResponse({
					values: data.values,
					totalCount: bigint(data.totalCount, true, "totalCount is not valid"),
				}),
		);
	}

	/**
	 * レポート取得
	 *
	 * GET /v1.0/reports に対応する
	 *
	 * Errors
	 * * Invalid Parameter リクエストに間違いがある
	 */
	public getReports(args: GetReportsRequest): Promise<NicoApiResponse<PagingResponse<any>>> {
		const obj: any = Object; // node.d.ts を最新にすれば不要
		const req: any = obj.assign({}, args);
		// Date to ISO string:
		if (args.since) {
			delete req.since;
			req.since = moment(args.since).format();
		}
		if (args.until) {
			delete req.until;
			req.until = moment(args.until).format();
		}
		return this.getReportsMethod.exec(req);
	}
}
