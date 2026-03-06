import constants = require("../constants");
/**
 * masterへのプロセスエラー報告用情報
 */
interface ProcessStatusInfoLike {
	/**
	 * 状態変更が発生したインスタンスID
	 */
	instanceId: string;
	/**
	 * 発生した状態変化
	 */
	type: constants.ProcessStatusType;
	/**
	 * メッセージ
	 */
	message: string;
}
export = ProcessStatusInfoLike;
