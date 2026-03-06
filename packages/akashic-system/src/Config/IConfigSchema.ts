/**
 * ミドルウェアへの接続情報の設定スキーマ。
 *
 * 各ドメイン / サービスの設定スキーマは、各々のサブディレクトリ内で定義する。
 * 必要に応じて、それらを使って、このファイルでキーの宣言をする。
 */
import type { RedisOptions } from "ioredis";
import * as Mysql from "mysql";

export interface IDatabaseHost {
	host: string;
	port: number;
}

/**
 * MySQL / MariaDB へ接続するときの設定
 */
export interface IDatabaseConfig {
	/**
	 * 接続先ホスト一覧
	 * ただし、実装上 1つしか設定できず、2つ以上与えるとエラーになる。
	 *
	 * もともと「galera-clusterの各ノード」を設定する用途で複数おけるようになっていたようだが、
	 *   そもそも RDBMS はレプリケーションするものなので、 read / write を明示して設定する必要があるので、
	 *   配列だと情報不足になる。
	 *   結果として、配列型な点は用途がなくなり、ただの歴史的経緯によるものとなった。
	 */
	hosts: IDatabaseHost[];
	database: string;
	user?: string;
	password?: string;

	/**
	 * 接続管理にコネクションプールを使用するかしないか
	 *
	 * 歴史的経緯により存在している設定値。
	 * 現在は常に connection pool が使用されるため、 `true` のみを取る。
	 */
	pool?: true;

	/**
	 * PoolCluster のオプション
	 * 「pool が true」 かつ 「hosts に複数ホストが指定されている」時に、PoolCluster のオプションとして渡される。
	 *
	 * ただし、現状、「 pool は常に true」かつ「hosts は1つしか与えられない」ので、使用されない。
	 *
	 * @see https://github.com/mysqljs/mysql#poolcluster-options
	 */
	poolClusterOptions?: Mysql.PoolClusterConfig;

	/**
	 * connectionLimit
	 *
	 * @see https://github.com/mysqljs/mysql#pool-options
	 */
	poolConnectionLimit?: number;

	/**
	 * waitForConnections
	 *
	 * @see https://github.com/mysqljs/mysql#pool-options
	 */
	poolWaitForConnections?: boolean;

	/**
	 * queueLimit
	 *
	 * @see https://github.com/mysqljs/mysql#pool-options
	 */
	poolQueueLimit?: number;
}

export interface IRabbitMQConfig {
	url: string | string[];
	user?: string;
	password?: string;
}

export interface IZookeeperHost {
	host: string;
	port: number;
	path?: string;
}

/**
 * @see https://github.com/yfinkelstein/node-zookeeper#input-parameters
 */
export interface IZookeeperOptions {
	timeout?: number;
	data_as_buffer?: boolean;
	debug_level?: number;
	host_order_deterministic?: boolean;
	client_id?: number | string;
	client_password?: string;
	encoding?: string;
}

export interface IZookeeperConfig {
	hosts: IZookeeperHost[];
	options?: IZookeeperOptions;
}

export type IRedisConfig =
	| {
			// single node
			host: string;
			port: number;
			option?: {
				family?: number;
				path?: string;
				keepAlive?: number;
				connectionName?: string;
				password?: string;
				db?: number;
				enableReadyCheck?: boolean;
				keyPrefix?: string;
				retryStrategy?: (times: number) => number;
				reconnectOnError?: (error: Error) => boolean;
				enableOfflineQueue?: boolean;
				connectTimeout?: number;
				autoResubscribe?: boolean;
				autoResendUnfulfilledCommands?: boolean;
				lazyConnect?: boolean;
				tls?: {
					ca: Buffer;
				};
				sentinels?: { host: string; port: number }[];
				name?: string;
				readOnly?: boolean;
				dropBufferSupport?: boolean;
			};
	  }
	| {
			// cluster
			hosts: {
				host: string;
				port: number;
			}[];
			options?: {
				// tslint:disable-next-line
				clusterRetryStrategy?: (number: number) => number;
				enableOfflineQueue?: boolean;
				enableReadyCheck?: boolean;
				scaleReads?: string;
				maxRedirections?: number;
				retryDelayOnFailover?: number;
				retryDelayOnClusterDown?: number;
				retryDelayOnTryAgain?: number;
				slotsRefreshTimeout?: number;
				redisOptions?: RedisOptions;
			};
	  };

export interface IPlaylogStoreConfig {
	backend: "mongodb";
	mongodb: {
		url: string;
	};
}

export interface IConfigSchema {
	/**
	 * RDBMS へ接続するための情報
	 */
	dbSettings?: IDatabaseConfig;

	/**
	 * Redis へ接続するための情報
	 */
	redis?: IRedisConfig;

	/**
	 * RabbitMQ へ接続するための情報
	 */
	rabbitmq?: IRabbitMQConfig;

	/**
	 * Zookeeper へ接続するための情報
	 */
	zookeeper?: IZookeeperConfig;

	/**
	 * Playlog Store で使うミドルウェアへ接続するための情報
	 */
	datastore?: IPlaylogStoreConfig;
}
