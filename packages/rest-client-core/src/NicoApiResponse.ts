import NicoApiMetaResponse = require("./NicoApiMetaResponse");
/**
 * ニコニコAPIの共通レスポンス
 */
interface NicoApiResponse<T> {
	/**
	 * meta情報
	 */
	meta: NicoApiMetaResponse;
	/**
	 * data情報
	 */
	data?: T;
}
export = NicoApiResponse;
