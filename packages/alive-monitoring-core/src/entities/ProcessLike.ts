/**
 * プロセス情報
 */
export interface ProcessLike {
	/**
	 * プロセスを一意に表わすもの
	 * i.e. FQDN + pid
	 */
	id: string;
	/**
	 * プロセスの特徴
	 * i.e. standard_websocket, fast_long_polling
	 */
	trait: string;
	/**
	 * プロセスのエンドポイント
	 * i.e. ws://akashic.playlog.com/
	 */
	endpoint: string;
	/**
	 * プロセスが処理可能なクライアント数
	 */
	numMaxClients: number;
	/**
	 * プロセス資源予約のためのエンドポイント
	 */
	reservationEndpoint: string;
}
