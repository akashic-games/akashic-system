/**
 * レポート情報を表すinterface
 */
export interface ReportLike {
	/**
	 * レポートID
	 */
	id?: string;
	/**
	 * 検索キー
	 */
	searchKey: string;
	/**
	 * 検索キーに対応する値
	 */
	searchValue: string;
	/**
	 * 作成日時
	 */
	createdAt: Date;
	/**
	 * レポート値
	 */
	value: string;
}
