/**
 * akashicに登録するイベントハンドラ
 */
export interface EventHandlerLike {
	/**
	 * イベントハンドラのID
	 */
	id?: string;
	/**
	 * イベントハンドラ種別
	 */
	type: string;
	/**
	 * イベント通知先
	 */
	endpoint: string;
	/**
	 * イベントの通知方法
	 */
	protocol: string;
}
