export interface GameEvent {
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
	 * ゲームイベント種別
	 */
	type: string;
	/**
	 * イベントに使われるデータ
	 */
	data: any;
}
