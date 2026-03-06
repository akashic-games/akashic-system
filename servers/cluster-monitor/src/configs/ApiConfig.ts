export interface ApiHost {
	baseUrl: string;
}
export interface ApiConfigs {
	[key: string]: ApiHost;
}
/** 設定のコールバックオブジェクトになければいけない値の定義 */
export interface CallbackObject {
	path: string;
	isSSL: boolean;
}
