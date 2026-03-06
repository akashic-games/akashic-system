import * as dt from "@akashic/server-engine-data-types";
import * as tapper from "@akashic/tapper";
import { ConnectionFactory } from "../connections/ConnectionFactory";
import { Play as Record } from "../records/Play";
import { Count } from "../records/Systems";
import { RecordOrder } from "../utils/RecordOrders";
import { asOne, enterContext, toPaging } from "../utils/RepositoryUtils";

/**
 * プレー
 */
export class Play {
	private _factory: ConnectionFactory;
	constructor(factory: ConnectionFactory) {
		this._factory = factory;
	}
	/**
	 * プレーの取得
	 */
	public get(id: string, connection?: tapper.Connection): Promise<dt.Play> {
		return enterContext(this._factory, connection, (context) =>
			context.query(Record, "SELECT * FROM plays WHERE id = CAST(? AS unsigned)", [id]),
		)
			.then((records) => records.map((record) => record.toEntity()))
			.then(asOne);
	}
	/**
	 * プレーの取得(行ロック付き)
	 */
	public getWithLock(id: string, connection?: tapper.Connection): Promise<dt.Play> {
		return enterContext(this._factory, connection, (context) =>
			context.query(Record, "SELECT * FROM plays WHERE id = CAST(? AS unsigned) FOR UPDATE", [id]),
		)
			.then((records) => records.map((record) => record.toEntity()))
			.then(asOne);
	}
	/**
	 * 指定した条件でプレー情報を検索する
	 */
	public find(
		gameCode?: string,
		status?: string[],
		offset?: number,
		limit?: number,
		order?: RecordOrder,
		connection?: tapper.Connection,
	): Promise<dt.Play[]> {
		return enterContext(this._factory, connection, (context) =>
			context.query(
				Record,
				toPaging("SELECT * FROM plays" + this.getsWhere(gameCode, status) + this.getsOrderByPlayId(order), offset, limit),
			),
		).then((records) => records.map((record) => record.toEntity()));
	}
	/**
	 * プレー情報を保存する
	 */
	public save(play: dt.Play, connection?: tapper.Connection): Promise<dt.Play> {
		return enterContext(this._factory, connection, (context) =>
			context
				.execute("INSERT INTO plays SET " + tapper.escape(Record.fromPatch(play), false))
				.then((okPacket) => this.get(String(okPacket.insertId), context)),
		);
	}
	/**
	 * ゲーム情報の件数を取得
	 */
	public count(gameCode?: string, status?: string[], connection?: tapper.Connection): Promise<string> {
		return enterContext(this._factory, connection, (context) =>
			context.query(Count, "SELECT COUNT(*) as count FROM plays" + this.getsWhere(gameCode, status)),
		)
			.then((records) => records.map((record) => record.count))
			.then(asOne);
	}
	/**
	 * プレーの更新
	 */
	public update(play: dt.Play, connection?: tapper.Connection): Promise<dt.Play> {
		// この関数を呼び出す前にfindして値をチェックしている前提で作っている
		const data: any[] = [];
		let sql = "UPDATE plays SET status = ?";
		data.push(play.status);
		if (play.finished) {
			sql += ", finished = ?";
			data.push(play.finished);
		}
		sql += " WHERE id = CAST(? AS unsigned)";
		data.push(play.id);
		return enterContext(this._factory, connection, (context) => context.execute(sql, data).then(() => this.get(play.id, context)));
	}

	private getsWhere(gameCode?: string, status?: string[]): string {
		const expressions: string[] = [];
		if (gameCode) {
			expressions.push(tapper.format("gameCode = ?", [gameCode]));
		}
		if (status) {
			const expression = "status IN (" + status.map((state) => tapper.format("?", [state])).join(", ") + ")";
			expressions.push(expression);
		}
		return expressions.length === 0 ? "" : " WHERE " + expressions.join(" AND ");
	}

	private getsOrderByPlayId(order?: RecordOrder): string {
		return order ? " ORDER BY id " + order.value : "";
	}
}
