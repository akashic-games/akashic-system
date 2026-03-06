/**
 * APIリクエスト情報
 */
interface NicoApiInfo {
	/**
	 * HTTPメソッド。GET/POST/PUT等
	 */
	method: string;
	/**
	 * APIのURL
	 * http://api.example.com:11223/v1.0/users/:userId?foo=:bar
	 */
	url: string;
}
export = NicoApiInfo;
