/**
 * ページングレスポンスEntity
 */
interface PagingResponseLike<T> {
	/**
	 * 返却する情報の配列
	 */
	values: T[];
	/**
	 * ページングに使用する総件数
	 */
	totalCount?: string;
}
export = PagingResponseLike;
