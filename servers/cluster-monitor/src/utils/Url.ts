export function createSearchRedirectUrl(baseUrl: string, body: any): string {
	let query = "";
	let following = false;
	const keys = Object.keys(body);
	for (let i = 0; i < keys.length; i++) {
		if (!!body[keys[i]]) {
			query += following ? "&" : "?";
			query += keys[i] + "=" + global.encodeURIComponent(body[keys[i]]);
			following = true;
		}
	}
	return baseUrl + query;
}

export function escapeElasticsearchSpecialChars(str: string, isWildCardUse: boolean = true): string {
	// + - && || ! ( ) { } [ ] ^ " ~ * ? : \ の前に\をつける
	// @see https://ameblo.jp/itboy/entry-11765017789.html
	const result = str.replace(/\\/g, "\\\\");
	return isWildCardUse
		? result.replace(/\+|\-|&&|\|\||!|\(|\)|\{|\}|\[|\]|\^|"|~|\?|:/g, "\\$&")
		: result.replace(/\+|\-|&&|\|\||!|\(|\)|\{|\}|\[|\]|\^|"|~|\*|\?|:/g, "\\$&");
}
