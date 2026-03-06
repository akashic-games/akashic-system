export { default as HostInfoClient } from "./HostInfoClient";
export { default as PlaylogServerHostInfoClient } from "./PlaylogServerHostInfoClient";
export { default as PlaylogServerSessionClient } from "./PlaylogServerSessionClient";
export * from "./DataTypes";
export import PlaylogServerInfoClient = require("./PlaylogServerInfoClient");
export import ProcessClient = require("./ProcessInfoClient");

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
