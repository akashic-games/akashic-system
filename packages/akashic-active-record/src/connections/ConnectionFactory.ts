import * as tapper from "@akashic/tapper";
import * as mysql from "mysql";
import { DatabaseConfig } from "./DatabaseConfig";

export class ConnectionFactory {
	private _config: DatabaseConfig;
	private _pool: tapper.Pool; // pool 利用かつ DB ホスト 1 つのときに利用
	private _poolCluster: tapper.PoolCluster; // pool 利用かつ DB ホスト 複数のときに利用
	private _roundRobinCounter: number;

	constructor(config: DatabaseConfig, usePool: boolean) {
		this._config = config;
		if (usePool) {
			if (config.hosts.length > 1) {
				this._pool = null;
				this._poolCluster = this._setupPoolCluster();
			} else {
				this._pool = this._setupPool();
				this._poolCluster = null;
			}
		}
		this._roundRobinCounter = 0;
	}

	public getConnection(): Promise<tapper.Connection> {
		if (this._pool) {
			return this._pool.getConnection();
		}
		if (this._poolCluster) {
			return this._poolCluster.getConnection();
		}

		const databaseHost = this._config.hosts[this._roundRobinCounter];
		const conf = this._makeConnectionConfig(databaseHost.host, databaseHost.port);
		const connection = tapper.createConnection(conf);
		this._roundRobinCounter = this._roundRobinCounter++ % this._config.hosts.length;
		return Promise.resolve(connection);
	}
	public getPool(): tapper.Pool {
		if (this._pool) {
			return this._pool;
		}
		throw new Error("not using pool");
	}

	public release(connection: tapper.Connection): Promise<void> {
		if (this._pool || this._poolCluster) {
			return Promise.resolve<void>(connection.release());
		}
		return connection.end();
	}

	public end(): Promise<void> {
		if (this._pool) {
			return this._pool.end();
		}
		if (this._poolCluster) {
			return this._poolCluster.end();
		}
	}

	private _makeConnectionConfig(host: string, port: number): mysql.ConnectionConfig {
		return {
			bigNumberStrings: true,
			supportBigNumbers: true,
			database: this._config.database,
			host,
			user: this._config.user,
			password: this._config.password,
			port,
			charset: "utf8mb4",
			stringifyObjects: true, // Objectのescapeの挙動がSQLインジェクション事故の元。。。
		};
	}

	private _makePoolConfig(host: string, port: number): mysql.PoolConfig {
		const result: mysql.PoolConfig = this._makeConnectionConfig(host, port);
		if (typeof this._config.poolConnectionLimit === "number") {
			result.connectionLimit = this._config.poolConnectionLimit;
		}
		// queueLimitとwaitForConnectionsの設定。コネクションプールの最大値を超えるリクエストが来た時の挙動の調節に使用
		if (typeof this._config.poolWaitForConnections === "boolean") {
			result.waitForConnections = this._config.poolWaitForConnections;
		}
		if (typeof this._config.poolQueueLimit === "number") {
			result.queueLimit = this._config.poolQueueLimit;
		}
		return result;
	}

	private _setupPool(): tapper.Pool {
		const host = this._config.hosts[0].host;
		const port = this._config.hosts[0].port;
		return tapper.createPool(this._makePoolConfig(host, port));
	}

	private _setupPoolCluster(): tapper.PoolCluster {
		const result = tapper.createPoolCluster(this._config.poolClusterOptions);
		this._config.hosts
			.map((databaseHost) => this._makePoolConfig(databaseHost.host, databaseHost.port))
			.forEach((poolConf) => result.add(poolConf));
		return result;
	}
}
