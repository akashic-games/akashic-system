/**
 * ニコニコシステム間のレスポンスメタデータ
 */
interface NicoApiMetaResponse {
	/**
	 * ステータスコード。useStatusFromHeaderがtrueの時はレスポンスヘッダのステータスコード
	 */
	status: number;
	/**
	 * エラーコード
	 */
	errorCode?: string;
	/**
	 * デバッグ情報
	 */
	debug?: any;
	/**
	 * エラーメッセージ
	 */
	errorMessage?: string;
	/**
	 * その他meta情報
	 */
	[key: string]: any;
}
export = NicoApiMetaResponse;
