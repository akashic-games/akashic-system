/**
 * node-mysqlの結果セット無しのクエリを実行した時に返る値
 * (本来なら仕様がnode-mysqlに書かれて、d.tsに書かれるべき物)
 * https://dev.mysql.com/doc/internals/en/packet-OK_Packet.html
 */
export interface OkPacket {
	/**
	 * node-mysql上では意味のあるかのような変数名になっているが、
	 * 古いクライアントとで処理を分けるためのheader値。
	 * 0か0xfeになる。
	 */
	fieldCount: number;
	/**
	 * クエリによって影響を受けた行数
	 */
	affectedRows: number;
	/**
	 * last_insert_id
	 */
	insertId: number;
	/**
	 * 結果に対するサーバ側ステータス。protocol41=trueのみ存在
	 * https://dev.mysql.com/doc/internals/en/status-flags.html
	 */
	serverStatus?: number;
	/**
	 * クエリによるwarning数。protocol41=trueのみ存在
	 */
	warningCount?: number;
	/**
	 * human readableなstatus情報
	 */
	message: string;
	// 不明。node-mysqlが生成した謎の値。使ってはいけないのでコメントアウトする
	// changedRows: number;
	/**
	 * protocol41フラグ
	 */
	protocol41: boolean;
}

// rx.js compatibleなインターフェイス
export interface Observable<T> {
	subscribe(observer: Observer<T>): Disposable;
}
export interface Observer<T> {
	onNext(value: T): void;
	onError(exception: any): void;
	onCompleted(): void;
}
export interface Disposable {
	dispose(): void;
}
