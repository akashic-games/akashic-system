import * as Mysql from "mysql";
import type { IPlayDatabase } from "./IPlayDatabase";

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

export class PlayDatabase implements IPlayDatabase {
	private readonly connectionFactory: Mysql.Pool;

	constructor(connectionFactory: Mysql.Pool) {
		this.connectionFactory = connectionFactory;
	}

	getStarted(playId: string): Promise<Date | null> {
		return this.withConnection(async (connection) => {
			const plays = await query<{ started: Date }>(connection, "SELECT started FROM plays WHERE id = ?", [playId]);
			if (plays.length === 0) {
				return null;
			}
			return plays[0].started;
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
