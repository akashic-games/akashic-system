import { createSearchRedirectUrl, escapeElasticsearchSpecialChars } from "./Url";

describe("createSearchRedirectUrl", () => {
	it("オブジェクトのパラメータがエンコードされ、基準のパスに付与されたものが返る", () => {
		const body = { report_type: "crash", message: "boost::filesystem" };
		expect(createSearchRedirectUrl("/test", body)).toEqual("/test?report_type=crash&message=boost%3A%3Afilesystem");
	});
});

describe("escapeElasticsearchSpecialChars", () => {
	it("文字列を与えた時Elasticsearchでエスケープが必要な文字がワイルドカードを除きエスケープされたものが返る", () => {
		const actual = 'a+b-c&&d||e!f(g)h{i}j[k]l^m"n~o*p?q:r\\s';
		const expected = 'a\\+b\\-c\\&&d\\||e\\!f\\(g\\)h\\{i\\}j\\[k\\]l\\^m\\"n\\~o*p\\?q\\:r\\\\s';
		expect(escapeElasticsearchSpecialChars(actual)).toEqual(expected);
	});
	it("文字列とワイルドカード除去を与えた時、Elasticsearchでエスケープが必要な文字がエスケープされたものが返る", () => {
		const actual = 'a+b-c&&d||e!f(g)h{i}j[k]l^m"n~o*p?q:r\\s';
		const expected = 'a\\+b\\-c\\&&d\\||e\\!f\\(g\\)h\\{i\\}j\\[k\\]l\\^m\\"n\\~o\\*p\\?q\\:r\\\\s';
		expect(escapeElasticsearchSpecialChars(actual, false)).toEqual(expected);
	});
});
