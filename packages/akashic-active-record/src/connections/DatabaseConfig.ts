import { PoolClusterConfig } from "mysql";

/**
 * ホストの設定(galera-clusterの各ノード)
 */
export interface DatabaseHost {
	host: string;
	port: number;
}
/**
 * 接続設定
 */
export interface DatabaseConfig {
	/**
	 * 接続先ホスト一覧(galera-clusterの各ノード)
	 */
	hosts: DatabaseHost[];
	database: string;
	user?: string;
	password?: string;
	/**
	 * 接続管理にコネクションプールを使用するかしないか
	 */
	pool?: boolean;
	/**
	 * PoolCluster のオプション (https://github.com/mysqljs/mysql#poolcluster-options)
	 * pool が true かつ hosts に複数ホストが指定されている時に、PoolCluster のオプションとして渡される
	 */
	poolClusterOptions?: PoolClusterConfig;
	/**
	 * コネクションプール使用時の最大接続数(デフォルトはnode-mysqlに従い10)
	 */
	poolConnectionLimit?: number;
	/**
	 * コネクションプール使用時に、最大接続数を超えるクエリを一度に受けた時にあふれた分が順番待ちになるか。
	 * trueなら順番待ちを行い、接続が空き次第、クエリを解決する。falseなら順番待ちを行わずにエラーになる。(デフォルトはnode-mysqlに従いtrue)
	 */
	poolWaitForConnections?: boolean;
	/**
	 * poolWaitForConnectionsがtrueの時の順番待ちキューの最大待機列長を指定する。
	 * この値を超えた待ちが発生している場合は、poolWaitForConnectionsがtrueになっていても、順番待ちを行わずにエラーになる。
	 * ただし、値が0の場合は無限にキューの順番待ちが行える。(デフォルトはnode-mysqlに従い0)
	 */
	poolQueueLimit?: number;
}
