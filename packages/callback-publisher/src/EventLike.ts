export interface EventLike<T> {
	/**
	 * イベントID
	 */
	id?: string;
	/**
	 * カテゴリ
	 */
	category: string;
	/**
	 * イベント種別
	 */
	type: string;
	/**
	 * イベント固有の情報
	 */
	payload?: T;
}
