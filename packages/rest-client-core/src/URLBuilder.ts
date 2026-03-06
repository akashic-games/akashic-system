import cloneDeep = require("lodash.clonedeep");
import url = require("url");

/**
 * URLとデータを元に組み立てるユーティリティ
 */
class URLBuilder {
	private parsedUrl: url.UrlWithParsedQuery;
	constructor(urlString: string) {
		this.parsedUrl = url.parse(urlString, true);
		if (!this.parsedUrl.protocol || !this.parsedUrl.hostname) {
			throw new TypeError("url: " + urlString + "is not valid");
		}
		this.parsedUrl.hostname = null;
		this.parsedUrl.port = null;
		this.parsedUrl.search = null;
		this.parsedUrl.path = null;
	}
	/**
	 * URLにbindする値のKey-value Objectを渡して、URLを組み立てる
	 *
	 * 例:
	 * http://example.com/v1.0/:hoge?fuga=:fuga&piyo=:piyo がコンストラクタで渡され
	 * { hoge: "foo", fuga: "bar"}がdataに渡された場合
	 *
	 * 出力されるのは http://example.com/v1.0/foo?fuga=bar である。
	 */
	public build(data?: any): string {
		const result: url.UrlWithParsedQuery = cloneDeep<url.UrlWithParsedQuery>(this.parsedUrl); // 1. パース済みURLObjectをコピー

		if (result.pathname == null) {
			result.pathname = "";
		}

		// 2. パスのプレースホルダにデータをバインドする
		result.pathname =
			"/" +
			result.pathname
				.substring(1)
				.split("/") // 2.1 パスを/で分解し、それをleafとする
				.map((leaf) => {
					if (leaf.charAt(0) !== ":") {
						// 2.2 先頭に:がついてないleafはプレースホルダじゃないので通す
						return leaf;
					}
					if (!data || typeof data[leaf.substring(1)] === "undefined") {
						// 2.3 プレースホルダに対応するキーがdataにあるかを確認
						throw new TypeError("path variable: " + leaf.substring(1) + " is not exists in data"); // なければエラー
					}
					return encodeURIComponent(data[leaf.substring(1)]); // 2.4プレースホルダの代わりにdataの入力値をleafとしてescapeして渡す
				})
				.join("/"); // 最組み立てする
		// 3. クエリ部分のプレースホルダにデータをバインドする
		Object.keys(result.query).forEach((qkey) => {
			const qval = result.query[qkey]; // 3.1 クエリの値部分を取得
			// NOTE: parse 結果が array になるパターン ("?foo=:bar&foo=:baz" 等) は未対応
			if (!Array.isArray(qval) && qval && qval.charAt(0) === ":") {
				// 3.2 値がプレースホルダ？
				if (data && typeof data[qval.substring(1)] !== "undefined") {
					// 3.3 対応する値がdataにあるか？
					result.query[qkey] = data[qval.substring(1)]; // 3.4 値を差し替える(encodeしてないのは後のformatでencodeされるため)
				} else {
					delete result.query[qkey]; // 3.4 対応する値が無い場合は値を削除
				}
			}
		});
		return url.format(result); // urlモジュールを使って組み立てる
	}
}
export = URLBuilder;
