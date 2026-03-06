import * as mysql from "mysql";
import Connection from "./Connection";

/**
 * 複数のコネクションプールを扱うクラス
 */
export default class PoolCluster {
	private _origin: mysql.PoolCluster;
	/**
	 * node-mysqlのPoolCluster
	 */
	get origin(): mysql.PoolCluster {
		return this._origin;
	}
	constructor(origin: mysql.PoolCluster) {
		this._origin = origin;
	}
	/**
	 * Clusterに接続先を追加する
	 */
	public add(config: mysql.PoolConfig): void;
	public add(group: string, config: mysql.PoolConfig): void;
	public add(group: string | mysql.PoolConfig, config?: mysql.PoolConfig): void {
		if (config) {
			this.checkConfig(config);
			this._origin.add(group as string, config);
		} else {
			const conf: mysql.PoolConfig = group as mysql.PoolConfig;
			this.checkConfig(conf);
			this._origin.add(conf);
		}
	}
	/**
	 * コネクションを取得する
	 */
	public getConnection(group?: string, selector?: string): Promise<Connection> {
		return new Promise<Connection>((resolve, reject) => {
			const callback: (err: mysql.MysqlError, connection: mysql.PoolConnection) => void = (err, connection) => {
				if (err) {
					return reject(err);
				}
				return resolve(new Connection(connection));
			};
			const args: any[] = [callback];
			if (selector) {
				args.unshift(selector);
			}
			if (group) {
				args.unshift(group);
			}
			(this._origin as any).getConnection(...args); // 悲しみ。。。
		});
	}
	/**
	 * コネクションを終了する
	 */
	public end(): Promise<void> {
		return new Promise<void>((resolve, reject) =>
			this._origin.end((err) => {
				if (err) {
					reject(err);
				}
				resolve(undefined);
			}),
		);
	}
	private checkConfig(config: mysql.ConnectionConfig): void {
		// bignumber周りのチェック
		if (!config.supportBigNumbers || !config.bigNumberStrings) {
			throw new Error("mysql connection must set supportBigNumbers and bigNumberStrings to be true");
		}
	}
}
