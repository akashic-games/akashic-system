export import PermissionServerClient = require("./PermissionServerClient");
export import PlayClient = require("./PlayClient");
export * from "./MasterClientComplex";
export import InstanceClient = require("./InstanceClient");
export import PlayLogEventClient = require("./PlayLogEventClient");
export * from "./ReportClient";

import restClientCore = require("@akashic/rest-client-core");

/**
 * エラーオブジェクトからHTTP Status Codeを抽出する。
 *
 * @param error 抽出対象のオブジェクト
 * @return エラーオブジェクトがこのライブラリのエラーならばStatus Codeが返却される
 */
export function getHttpStatusCode(error: any) {
	return restClientCore.Errors.getHttpStatusCode(error);
}

/**
 * NOT FOUNDエラーかどうかを判定する
 * @param error 判定対象のオブジェクト
 */
export function isNotFound(error: any) {
	return restClientCore.Errors.isNotFound(error);
}

/**
 * CONFLICTエラーかどうかを判定する
 * @param error 判定対象のオブジェクト
 */
export function isConflict(error: any) {
	return restClientCore.Errors.isNotFound(error);
}
