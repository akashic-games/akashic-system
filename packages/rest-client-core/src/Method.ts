import request = require("superagent");
import util = require("util");
import { LoggerAware } from "@akashic-system/logger";
import errors = require("./errors");
import MethodOptions = require("./MethodOptions");
import NicoApiInfo = require("./NicoApiInfo");
import NicoApiResponse = require("./NicoApiResponse");
import URLBuilder = require("./URLBuilder");

const startRequestContext = new Map([
	["action", "rest-client-core"],
	["event", "start"],
]);

const endRequestContext = new Map([
	["action", "rest-client-core"],
	["event", "end"],
]);

/**
 * REST APIを呼び出すクラス
 */
export class Method<Response> extends LoggerAware {
	private builder: URLBuilder;
	private info: NicoApiInfo;
	private castResponseData?: (response: any) => Response;
	private options: MethodOptions;
	constructor(info: NicoApiInfo, responseDataCast?: (data: any) => Response, options?: MethodOptions) {
		super();
		this.builder = new URLBuilder(info.url);
		this.info = info;
		this.castResponseData = responseDataCast;
		this.options = options || {};
	}
	public exec(urlData?: any, body?: any, header?: any): Promise<NicoApiResponse<Response>> {
		const url = this.builder.build(urlData);
		return this.doRequest(url, body, header)
			.then((response) => this.validateNicoApiResponse(response))
			.then((response) => this.checkErrorCode(response))
			.then((response) => this.validateResponse(response));
	}
	private doRequest(url: string, body: any, header: any): Promise<request.Response> {
		let r = request(this.info.method, url).accept("json");
		if (this.options.timeout) {
			r = r.timeout(this.options.timeout);
		}
		if (header) {
			r = r.set(header);
		}
		if (body && this.canHaveBody(this.info.method)) {
			r = r.send(body).type("json");
		}
		this.logger.trace("start request", startRequestContext);
		return new Promise<request.Response>((resolve, reject) =>
			r.end((err: any, res: request.Response) => {
				if (err && !err.status) {
					reject(err);
				} else {
					this.logger.trace("end request", endRequestContext);
					resolve(res);
				}
			}),
		);
	}
	private validateNicoApiResponse(response: request.Response): Promise<NicoApiResponse<any>> {
		if (!response.body || !response.body.meta || !response.body.meta.status) {
			return Promise.reject(new errors.RestClientError("responseにmeta/statusがありません", errors.ErrorType.ParseError));
		}
		if (typeof response.body.meta.status !== "number" || response.body.meta.status < 100 || response.body.meta.status >= 600) {
			return Promise.reject(new errors.RestClientError("statusが数値で無いか範囲外です", errors.ErrorType.ParseError));
		}
		if (response.body.meta.status >= 400 && !response.body.meta.errorCode && !response.body.meta["error-code"]) {
			return Promise.reject(new errors.RestClientError("エラーresponseにmeta/errorCodeがありません", errors.ErrorType.ParseError));
		}
		const result: NicoApiResponse<any> = response.body;
		if (!response.body.meta.errorCode) {
			result.meta.errorCode = response.body.meta["error-code"];
		}
		if (this.options.useStatusFromHeader) {
			result.meta.status = response.status;
		}
		return Promise.resolve(result);
	}
	private checkErrorCode(response: NicoApiResponse<any>): Promise<NicoApiResponse<any>> {
		if (response.meta.status >= 400) {
			return Promise.reject(
				new errors.RestClientError(
					util.format("HTTPエラー: %d %s %j", response.meta.status, response.meta.errorCode, response.meta.debug),
					errors.ErrorType.HTTPError,
					response,
				),
			);
		}
		return Promise.resolve(response);
	}
	private validateResponse(response: NicoApiResponse<any>): NicoApiResponse<Response> {
		if (!this.castResponseData) {
			return response;
		}
		try {
			const data = this.castResponseData(response.data);

			return {
				meta: response.meta,
				data,
			};
		} catch (error) {
			throw new errors.RestClientError("response.dataのパースに失敗しました", errors.ErrorType.ParseError, response, error);
		}
	}

	private canHaveBody(method: string): boolean {
		return ["POST", "PUT", "PATCH", "DELETE"].indexOf(method) !== -1;
	}
}
