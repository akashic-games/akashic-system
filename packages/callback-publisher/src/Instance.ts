export interface Instance {
	/**
	 * プレーID
	 * リプレーの時、playIdは省略される為Optional
	 */
	playId?: string;
	/**
	 * インスタンスID
	 */
	instanceId: string;
	/**
	 * インスタンスの状態
	 */
	status: string;
	/**
	 * 終了コード
	 */
	exitCode?: number;
	/**
	 * 状態変更理由(エラー用)
	 */
	description?: string;
}
