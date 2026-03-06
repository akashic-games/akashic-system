import * as mysql from "mysql";
import Connection from "./Connection";
import * as dt from "./DataTypes";

/**
 * コネクションプール
 */
export default class Pool {
	private _origin: mysql.Pool;
	/**
	 * node-mysqlのPoolオブジェクト
	 */
	get origin(): mysql.Pool {
		return this._origin;
	}
	constructor(origin: mysql.Pool) {
		// mysqlドライバの謎。どうしてここにオプションを分けたのだろうか？？？　仕様なのか不明なので、どっちでも対処できるコードに。
		const config: mysql.ConnectionConfig = (origin.config as any).connectionConfig
			? (origin.config as any).connectionConfig
			: (origin as any).config;

		// bignumber周りのチェック
		if (!config.supportBigNumbers || !config.bigNumberStrings) {
			throw new Error("mysql connection must set supportBigNumbers and bigNumberStrings to be true");
		}
		this._origin = origin;
	}
	/**
	 * Poolからコネクションを取得する
	 */
	public getConnection(): Promise<Connection> {
		return new Promise<Connection>((resolve, reject) =>
			this._origin.getConnection((err, connection) => {
				if (err) {
					return reject(err);
				}
				return resolve(new Connection(connection));
			}),
		);
	}
	/**
	 * Poolを使って結果セットありのクエリを実行する
	 */
	public query<T>(TClass: new () => T, sql: string, values?: any): Promise<T[]> {
		return this.getConnection().then((conn) =>
			conn.query(TClass, sql, values).then((result) => {
				conn.release();
				return result;
			}),
		);
	}
	/**
	 * Poolを使って結果セット無しのクエリを実行する
	 */
	public execute(sql: string, values?: any): Promise<dt.OkPacket> {
		return this.getConnection().then((conn) =>
			conn.execute(sql, values).then((result) => {
				conn.release();
				return result;
			}),
		);
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
}
