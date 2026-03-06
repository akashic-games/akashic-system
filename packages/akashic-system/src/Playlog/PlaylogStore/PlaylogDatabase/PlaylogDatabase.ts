import * as Mysql from "mysql";
import type { IPlaylogLock } from "./IPlaylogLock";
import type { IPlaylogQueueStatusDatabase, WriteStatus } from "../../IPlaylogQueueStatusDatabase";

async function transaction<T>(connection: Mysql.PoolConnection, inTransaction: () => Promise<T>): Promise<T> {
	await new Promise<void>((resolve, reject) => {
		connection.beginTransaction((beginError) => {
			if (beginError) {
				return reject(beginError);
			}

			resolve();
		});
	});
	let result: T;
	try {
		result = await inTransaction();
		await new Promise<void>((resolve, reject) => {
			connection.commit((err) => {
				if (err) {
					return reject(err);
				}

				resolve();
			});
		});
	} catch (err) {
		connection.rollback();
		throw err;
	}
	return result;
}

function query<T>(connection: Mysql.PoolConnection, sql: string, values: unknown[]): Promise<T[]> {
	return new Promise<T[]>((resolve, reject) => {
		connection.query(sql, values, (queryError, data) => {
			if (queryError) {
				return reject(queryError);
			}

			resolve(data);
		});
	});
}

export type PlaylogEntity = {
	playId: string;
	writeStatus: WriteStatus;
};

export class PlaylogDatabase implements IPlaylogLock, IPlaylogQueueStatusDatabase {
	private readonly connectionFactory: Mysql.Pool;

	constructor(connectionFactory: Mysql.Pool) {
		this.connectionFactory = connectionFactory;
	}

	getWritingPlays(): Promise<{ playId: string; writeStatus: Omit<"closed", WriteStatus> }[]> {
		return this.withConnection(async (connection) => {
			return await query<PlaylogEntity>(connection, "SELECT * FROM playlogs WHERE writeStatus IN ('playing', 'closing')", []);
		});
	}

	setClosed(playId: string): Promise<void> {
		return this.withConnection(async (connection) => {
			await query(connection, "UPDATE playlogs SET writeStatus = 'closed' WHERE playId = ?", [playId]);
		});
	}

	setPlaying(playId: string): Promise<void> {
		return this.withConnection(async (connection) => {
			await query(
				connection,
				"INSERT INTO playlogs (playId, writeStatus) VALUES(?, 'playing') ON DUPLICATE KEY UPDATE writeStatus='playing'",
				[playId],
			);
		});
	}

	setClosing(playId: string): Promise<void> {
		return this.withConnection(async (connection) => {
			await query(connection, "UPDATE playlogs SET writeStatus = 'closing' WHERE playId = ?", [playId]);
		});
	}

	withPlaylogLock<T>(playId: string, inLock: () => Promise<T>): Promise<T> {
		return this.withConnection<T>(async (connection) => {
			return transaction<T>(connection, async () => {
				// mysqlの FOR UPDATEを使った行ロックを使って排他処理を実現する
				// TODO: 互換性のためにフィールド名をcamelにしているが、そもそもORM含めてどうするかは要相談
				const data = await query<PlaylogEntity>(connection, "SELECT * FROM playlogs WHERE playId = ? FOR UPDATE", [playId]);
				if (data.length === 0) {
					// mysqlの特性上、レコードが無い場合は排他できないのでエラーにする
					throw new Error(`${playId}に対応するレコードがplaylogsテーブルに存在せず、ロックが取れませんでした`);
				}
				return await inLock();
			});
		});
	}

	private async withConnection<T>(fn: (connection: Mysql.PoolConnection) => Promise<T>): Promise<T> {
		const connection = await new Promise<Mysql.PoolConnection>((resolve, reject) => {
			this.connectionFactory.getConnection((err, c) => {
				if (err) {
					return reject(err);
				}
				return resolve(c);
			});
		});
		try {
			return await fn(connection);
		} finally {
			connection.release();
		}
	}
}
