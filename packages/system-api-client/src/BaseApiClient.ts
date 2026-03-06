import { Method, MethodOptions, NicoApiInfo } from "@akashic/rest-client-core";

export interface MethodInfo {
	path: string;
	method: string;
}

export class BaseApiClient {
	private _baseUrl: string;

	get baseUrl() {
		return this._baseUrl;
	}

	constructor(baseUrl: string) {
		this._baseUrl = baseUrl.charAt(baseUrl.length - 1) === "/" ? baseUrl.substr(0, baseUrl.length - 1) : baseUrl;
	}

	protected createMethod<T>(methodInfo: MethodInfo, castData?: (data: any) => T, options?: MethodOptions) {
		return new Method<T>(this.createApiInfo(methodInfo), castData, options);
	}

	private createApiInfo(methodInfo: MethodInfo): NicoApiInfo {
		const path = methodInfo.path.charAt(0) === "/" ? methodInfo.path.substr(1) : methodInfo.path;
		return {
			url: this._baseUrl + "/" + path,
			method: methodInfo.method,
		};
	}
}
