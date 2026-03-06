/**
 * 動作中インスタンスへのリクエストキューに積む情報
 */
export interface InstanceRequestQueueMessage {
	/**
	 * リクエストタイプ
	 */
	type: "shutdown" | "pause" | "resume";
	/**
	 * shutdown対象のinstance id
	 */
	instanceId: string;
	/**
	 * 異常系処理のメッセージかどうか
	 * 異常系処理メッセージの場合、statusの更新を行わない
	 */
	isErrorRecovery: boolean;
}
