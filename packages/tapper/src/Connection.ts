import * as mysql from "mysql";
import * as dt from "./DataTypes";
import { FieldPacket } from "./internals/packets";
import { Subject } from "./internals/Subject";
import * as TypeChecker from "./internals/TypeChecker";

/**
 * ラップ済みmysqlコネクションクラス
 */
export default class Connection {
	private _origin: mysql.Connection | mysql.PoolConnection;
	private _doBigQuery = false;
	private _pooledConnection: boolean;
	/**
	 * node-mysqlのConnection
	 */
	get origin(): mysql.Connection {
		return this._origin;
	}
	constructor(origin: mysql.Connection) {
		// bignumber周りのチェック
		if (!origin.config.supportBigNumbers || !origin.config.bigNumberStrings) {
			throw new Error("mysql connection must set supportBigNumbers and bigNumberStrings to be true");
		}
		this._origin = origin;

		// origin が PoolConnection かどうかの判定
		// PoolConnection の場合、Connection のメソッドに release/end/destroy が追加されている。
		// end は deprecated 扱いなので、release/destroy の存在判定で行う。
		const poolConnection = origin as mysql.PoolConnection;
		if (typeof poolConnection.release === "function" && typeof poolConnection.destroy === "function") {
			this._pooledConnection = true;
		}
	}
	/**
	 * トランザクションの開始
	 */
	public beginTransaction(): Promise<void> {
		return new Promise<void>((resolve, reject) =>
			this._origin.beginTransaction((err) => {
				if (err) {
					return reject(err);
				}
				return resolve(undefined);
			}),
		);
	}
	/**
	 * トランザクションのコミット
	 */
	public commit(): Promise<void> {
		return new Promise<void>((resolve, reject) =>
			this._origin.commit((err) => {
				if (err) {
					return reject(err);
				}
				return resolve(undefined);
			}),
		);
	}
	/**
	 * トランザクションのロールバック
	 */
	public rollback(): Promise<void> {
		return new Promise<void>((resolve, _reject) =>
			this._origin.rollback(() => {
				return resolve(undefined);
			}),
		);
	}
	/**
	 * 結果セット付きのクエリを投げる
	 */
	public query<T>(TClass: new () => T, sql: string, values?: any): Promise<T[]> {
		return this._query(sql, values).then((tuple) => {
			const [data, fields] = tuple;
			return this.populate(TClass, fields, data);
		});
	}
	/**
	 * 巨大な結果セット付きのクエリを投げる
	 * メモ: このコネクションの結果が帰ってきている時に別のクエリをこのコネクションに対して投げてはいけない
	 */
	public bigQuery<T>(TClass: new () => T, sql: string, values?: any): dt.Observable<T> {
		const result = new Subject<T>();
		this._doBigQuery = true;
		const query = this._origin.query(sql, values);
		let fields: FieldPacket[];
		query
			.on("err", (err) => result.onError(err))
			.on("fields", (f) => (fields = f))
			.on("result", (row) => {
				if (!fields) {
					return result.onError(new Error("no field packet. may use bigQuery<T> for no response set query?"));
				}
				const item = this.populate(TClass, fields, [row]);
				result.onNext(item[0]);
			})
			.on("end", () => {
				this._doBigQuery = false;
				result.onCompleted();
			});
		return result;
	}
	/**
	 * 結果セット無しのクエリを投げる
	 */
	public execute(sql: string, values?: any): Promise<dt.OkPacket> {
		return new Promise<dt.OkPacket>((resolve, reject) => {
			this.checkDoBigQuery();
			this._origin.query(sql, values, (err: mysql.MysqlError, okPacket: dt.OkPacket) => {
				if (err) {
					return reject(err);
				}
				if (!okPacket || typeof okPacket.protocol41 !== "boolean") {
					return reject(new Error("no ok packet. may use execute for having response set query?"));
				}
				return resolve(okPacket);
			});
		});
	}
	/**
	 * コネクションをpoolに戻す
	 */
	public release(): void {
		if (!this._pooledConnection) {
			return;
		}

		(this._origin as mysql.PoolConnection).release();
	}
	/**
	 * コネクションを終了する
	 */
	public end(): Promise<void> {
		if (!this._pooledConnection) {
			return;
		}

		(this._origin as mysql.PoolConnection).end();
	}
	private checkDoBigQuery(): void {
		if (this._doBigQuery) {
			throw new Error("cannot do other query during bigQuery");
		}
	}
	private _query(sql: string, values?: any): Promise<[any[], FieldPacket[]]> {
		return new Promise<[any[], FieldPacket[]]>((resolve, reject) => {
			this.checkDoBigQuery();
			this._origin.query(sql, values, (err: mysql.MysqlError, data: any[], fields: FieldPacket[]) => {
				if (err) {
					return reject(err);
				}
				if (!fields) {
					return reject(new Error("no field packet. may use query<T> for no response set query?"));
				}
				return resolve([data, fields]);
			});
		});
	}
	private populate<T>(TClass: new () => T, fields: FieldPacket[], data: any[]): T[] {
		const casts: [string, (data: any) => any][] = [];
		for (const field of fields) {
			casts.push([field.name, TypeChecker.getCastFromFieldAndMetadata(field, TClass)]);
		}
		const results: T[] = [];
		for (const it of data) {
			const item: any = new TClass();
			for (const [key, converter] of casts) {
				item[key] = converter(it[key]);
			}
			results.push(item);
		}
		return results;
	}
}
