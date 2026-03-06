/**
 * Playlog Server 割り当て情報の設定
 * - type:static  静的な割り当て先を返す
 * - type:dynamic プレー状況を監視し最適な割り当て先を返す
 */
export interface DispatchingConfig {
	type: string;
	static?: StaticDispatchingConfig;
	dynamic?: DynamicDispatchingConfig;
}

export interface StaticDispatchingConfig {
	playlogServerUrl: string;
}

export interface DynamicDispatchingConfig {
	server: {
		monitorCacheExpireMsec: number;
		shuffleProcessCount: number;
	};

	playlogServer: {
		trait: string;
		apiProtocol: string;
	};

	// redis: unknown; // node-config の利用側の適正化に伴い、不要になったキー
}
