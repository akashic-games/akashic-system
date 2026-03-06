export interface PlayToken {
	id?: string;
	playId?: string;
	userId?: string;
	permission?: PlayTokenPermission;
}

export interface PlayTokenPermission {
	/**
	 * Tickを記録する権限を持つかどうか
	 */
	writeTick: boolean;
	/**
	 * Tickを読み込む権限を持つかどうか
	 */
	readTick: boolean;
	/**
	 * リアルタイムに発行されるTickを受信する権限を持つかどうか
	 */
	subscribeTick: boolean;
	/**
	 * イベントを送信する権限を持つかどうか
	 */
	sendEvent: boolean;
	/**
	 * 送信されたイベントを受信する権限を持つかどうか
	 */
	subscribeEvent: boolean;
	/**
	 * 送信できるイベントに指定できる最大優先度
	 */
	maxEventPriority: number;
}
