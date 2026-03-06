import util = require("util");
import NicoApiResponse = require("./NicoApiResponse");
export enum ErrorType {
	/**
	 * サーバが解釈不能なレスポンスを返却した。
	 */
	ParseError,
	/**
	 * サーバがレスポンスでHTTPエラーコード(4XX/5XX)を返した
	 */
	HTTPError,
	/**
	 * validatableが返す用のエラー
	 */
	ValidationError,
}

export class RestClientError implements Error {
	public name: string;
	public message: string = "";
	public details: string;
	public type: ErrorType;
	public body?: NicoApiResponse<any>;
	public internalError: any;
	constructor(details: string, type: ErrorType, body?: NicoApiResponse<any>, internalError?: any) {
		// V8向けHack
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, RestClientError); // この方式だとここのスタックまでがトレース対象になるが、それを修正するにはV8の改修が必要になるので諦める
		}
		this.name = "RestClientError";
		switch (type) {
			case ErrorType.ParseError:
			case ErrorType.ValidationError:
				this.message = "Parse Error";
				break;
			case ErrorType.HTTPError:
				this.message = (body && body.meta.errorCode) || "";
				break;
		}
		if (internalError) {
			this.message += " - [internal error] " + util.inspect(internalError);
		}
		this.details = details;
		this.type = type;
		this.body = body;
		this.internalError = internalError;
	}
}

/**
 * RestClientErrorかどうかを判定する
 * @param error 判定対象のオブジェクト
 */
export function isRestClientError(error: any): boolean {
	return error && error.name === "RestClientError";
}

/**
 * エラーオブジェクトからHTTP Status Codeを抽出する。
 *
 * @param error 抽出対象のオブジェクト
 * @return エラーオブジェクトがHTTP ErrorによるRestClientErrorならばStatus Codeが返却される
 */
export function getHttpStatusCode(error: any): number | null {
	if (!isRestClientError(error)) {
		return null;
	}
	const err: RestClientError = error;
	if (!err.body || !err.body.meta || typeof err.body.meta.status !== "number") {
		return null;
	}
	return err.body.meta.status;
}

/**
 * NOT FOUNDエラーかどうかを判定する
 * @param error 判定対象のオブジェクト
 */
export function isNotFound(error: any): boolean {
	return getHttpStatusCode(error) === 404;
}

/**
 * CONFLICTエラーかどうかを判定する
 * @param error 判定対象のオブジェクト
 */
export function isConflict(error: any): boolean {
	return getHttpStatusCode(error) === 409;
}
