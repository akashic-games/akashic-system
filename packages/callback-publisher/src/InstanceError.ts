export interface InstanceError {
	/**
	 * インスタンスID
	 */
	instanceId: string;
	/**
	 * エラーコード
	 */
	code: number;
	/**
	 * エラー詳細(Debug用)
	 */
	description?: string;
}
