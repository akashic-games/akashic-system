interface MethodOptions {
	/**
	 * meta/statusをhttpレスポンスヘッダで上書きするかどうか
	 */
	useStatusFromHeader?: boolean;

	/**
	 * タイムアウトするまでのミリ秒
	 */
	timeout?: number;
}
export = MethodOptions;
