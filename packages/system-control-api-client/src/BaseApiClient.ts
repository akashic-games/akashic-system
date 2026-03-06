import { LoggerAware } from "@akashic-system/logger";
import restClientCore = require("@akashic/rest-client-core");

/**
 * クライアントの基底クラス
 */
class BaseApiClient extends LoggerAware {
	private baseUrl: string;

	/**
	 * @param baseUrl 接続先の基底URL
	 * @param logger
	 */
	constructor(baseUrl: string) {
		super();
		this.baseUrl = baseUrl.charAt(baseUrl.length - 1) === "/" ? baseUrl.substr(0, baseUrl.length - 1) : baseUrl;
	}

	/**
	 * API情報からMethodオブジェクトを作成する
	 * @param methodInfo API情報
	 * @param castData レスポンス情報をキャストするために使用する関数
	 * @param options
	 */
	protected getMethod<T>(methodInfo: { path: string; method: string }, castData: (data: any) => T, options?: restClientCore.MethodOptions) {
		const method = new restClientCore.Method<T>(this.createApiInfo(methodInfo), castData, options);
		method.logger = this.logger;
		return method;
	}

	private createApiInfo(methodInfo: { path: string; method: string }): restClientCore.NicoApiInfo {
		const path = methodInfo.path.charAt(0) === "/" ? methodInfo.path.substr(1) : methodInfo.path;
		return {
			url: this.baseUrl + "/" + path,
			method: methodInfo.method,
		};
	}
}
export = BaseApiClient;
