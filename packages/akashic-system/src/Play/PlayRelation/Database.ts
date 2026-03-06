import * as Mysql from "mysql";
import { IDatabaseConfig } from "../../Config";
import { MysqlPoolFactory } from "../../infrastructure";
import { IPlayTokenPermissionBoundary } from "./IPlayTokenPermissionBoundary";
import { IPlayRelationModel } from "./PlayRelationModel";

export class Database implements IPlayRelationModel {
	public static fromConfig(config: IDatabaseConfig): Database {
		return new Database(MysqlPoolFactory.fromConfig(config));
	}

	private readonly connectionFactory: Mysql.Pool;

	constructor(connectionFactory: Mysql.Pool) {
		this.connectionFactory = connectionFactory;
	}

	public destroy(parentPlayId: string, childPlayId: string): Promise<boolean> {
		return this.query("DELETE FROM play_relations WHERE parent_id = ? & child_id = ?", [parentPlayId, childPlayId]).then(() => true);
	}

	public async findByChild(childPlayId: string): Promise<Map<string, IPlayTokenPermissionBoundary | null>> {
		const rows = await this.query<{ parent_id: string; play_token_permission_boundary: string }>(
			"SELECT parent_id, play_token_permission_boundary FROM play_relations WHERE child_id = ?",
			[childPlayId],
		);

		const playTokenPermissionBoundaries = new Map<string, IPlayTokenPermissionBoundary | null>();
		for (const row of rows) {
			let boundary: IPlayTokenPermissionBoundary | null = null;
			try {
				boundary = JSON.parse(row.play_token_permission_boundary);
			} catch (e) {
				// nothing
			}
			playTokenPermissionBoundaries.set(row.parent_id, boundary);
		}

		return playTokenPermissionBoundaries;
	}

	public store(parentPlayId: string, childPlayId: string, playTokenPermissionBoundary: IPlayTokenPermissionBoundary): Promise<boolean> {
		return this.query("INSERT INTO play_relations(parent_id, child_id, play_token_permission_boundary) VALUES (?, ?, ?)", [
			parentPlayId,
			childPlayId,
			JSON.stringify(playTokenPermissionBoundary),
		]).then(() => true);
	}

	// tslint:disable-next-line:no-any
	private async query<T>(sql: string, values?: any[]): Promise<T[]> {
		// 本当は Node.js v8.0+ の util.promisify を使いたかったが、 Node.js6 の環境があるため、妥協して callbackify なまま使う
		// tslint:disable-next-line:no-any
		return new Promise<any[]>((resolve, reject) => {
			this.connectionFactory.getConnection((connectionError, connection) => {
				if (connectionError) {
					reject(connectionError);
					return;
				}

				connection.query(sql, values, (queryError, data) => {
					// Pool なので。
					connection.release();

					if (queryError) {
						reject(queryError);
						return;
					}

					resolve(data);
					return;
				});
			});
		});
	}
}
