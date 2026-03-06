import * as dt from "@akashic/server-engine-data-types";
import * as tapper from "@akashic/tapper";
import { ConnectionFactory } from "../connections/ConnectionFactory";
import { Instance as Record } from "../records/Instance";
import { Count } from "../records/Systems";
import { asOne, count as recordCount, enterContext, toPaging } from "../utils/RepositoryUtils";

/**
 * インスタンス情報
 */
export class Instance {
	private _factory: ConnectionFactory;
	constructor(factory: ConnectionFactory) {
		this._factory = factory;
	}
	/**
	 * インスタンス情報の取得
	 */
	public get(id: string, connection?: tapper.Connection): Promise<dt.Instance> {
		return enterContext(this._factory, connection, (context) =>
			context.query(Record, "SELECT * FROM instances WHERE id = CAST(? AS unsigned)", [id]),
		)
			.then((records) => records.map((record) => record.toEntity()))
			.then(asOne);
	}
	/**
	 * インスタンス情報の取得 + 行ロック
	 */
	public getWithLock(id: string, connection?: tapper.Connection): Promise<dt.Instance> {
		return enterContext(this._factory, connection, (context) =>
			context.query(Record, "SELECT * FROM instances WHERE id = CAST(? AS unsigned) FOR UPDATE", [id]),
		)
			.then((records) => records.map((record) => record.toEntity()))
			.then(asOne);
	}
	/**
	 * インスタンスの保存
	 */
	public save(instance: dt.Instance, connection?: tapper.Connection): Promise<dt.Instance> {
		return enterContext(this._factory, connection, (context) =>
			context
				.execute("INSERT INTO instances SET " + tapper.escape(Record.fromPatch(instance), false))
				.then((okPacket) => this.get(String(okPacket.insertId), context)),
		);
	}
	/**
	 * インスタンスの削除
	 */
	public remove(id: string, connection?: tapper.Connection): Promise<void> {
		return enterContext(this._factory, connection, (context) =>
			context.execute("DELETE FROM instances WHERE id = CAST(? as unsigned)", [id]),
		).then<void>((_okPacket) => undefined);
	}
	/**
	 * インスタンスの状態/終了コードの更新
	 */
	public updateStatus(
		id: string,
		newStatus: string,
		exitCode?: number,
		processName?: string,
		connection?: tapper.Connection,
	): Promise<dt.Instance> {
		let query = "UPDATE instances SET status = ?";
		const where = " WHERE id = CAST(? as unsigned)";
		const placements: [number | string] = [newStatus];
		if (typeof exitCode === "number") {
			query += ", exitCode = ? ";
			placements.push(exitCode);
		}
		if (processName) {
			query += ", processName = ? ";
			placements.push(processName);
		}
		query += where;
		placements.push(id);
		return enterContext(this._factory, connection, (context) => context.execute(query, placements).then(() => this.get(id, context)));
	}

	/**
	 * インスタンスの検索
	 */
	public findInstance(
		gameCode?: string,
		status?: string[],
		processName?: string,
		entryPoint?: string,
		videoPublishUrl?: string,
		offset?: number,
		limit?: number,
		connection?: tapper.Connection,
	): Promise<dt.Instance[]> {
		if (videoPublishUrl) {
			return this.findInstanceWithVideoSetting(videoPublishUrl, gameCode, status, processName, entryPoint, offset, limit, connection);
		}
		return enterContext(this._factory, connection, (context) =>
			context.query(
				Record,
				toPaging("SELECT * from instances" + this.createWhereQuery(gameCode, status, processName, entryPoint), offset, limit),
			),
		).then((records) => records.map((record) => record.toEntity()));
	}

	/**
	 * 条件に一致するインスタンスの数を返す
	 */
	public count(
		gameCode?: string,
		status?: string[],
		processName?: string,
		entryPoint?: string,
		videoPublishUrl?: string,
		_offset?: number,
		_limit?: number,
		connection?: tapper.Connection,
	): Promise<string> {
		if (videoPublishUrl) {
			return this.countWithVideoSetting(videoPublishUrl, gameCode, status, processName, entryPoint, connection);
		}
		return recordCount(this._factory, connection, "instances", this.createWhereQuery(gameCode, status, processName, entryPoint));
	}

	/**
	 * VideoSetting.videoPublishUri も条件に含め、一致するインスタンスを検索する
	 */
	private findInstanceWithVideoSetting(
		videoPublishUrl: string,
		gameCode?: string,
		status?: string[],
		processName?: string,
		entryPoint?: string,
		offset?: number,
		limit?: number,
		connection?: tapper.Connection,
	): Promise<dt.Instance[]> {
		const subqueryWhere = videoPublishUrl !== "%" ? tapper.format(" WHERE videoPublishUri LIKE ?", [videoPublishUrl + "%"]) : "";
		const query =
			"SELECT * FROM ( " +
			"  SELECT * FROM videoSettings" +
			subqueryWhere +
			") AS vp " +
			"INNER JOIN instances ON instances.id = vp.instanceId";
		return enterContext(this._factory, connection, (context) =>
			context.query(Record, toPaging(query + this.createWhereQuery(gameCode, status, processName, entryPoint), offset, limit)),
		).then((records) => records.map((record) => record.toEntity()));
	}

	/**
	 * VideoSetting.videoPublishUri も条件に含め、一致するインスタンス数を返す
	 */
	private countWithVideoSetting(
		videoPublishUrl: string,
		gameCode?: string,
		status?: string[],
		processName?: string,
		entryPoint?: string,
		connection?: tapper.Connection,
	): Promise<string> {
		const subqueryWhere = videoPublishUrl !== "%" ? tapper.format(" WHERE videoPublishUri LIKE ?", [videoPublishUrl + "%"]) : "";
		const query =
			"SELECT COUNT(*) as count FROM ( " +
			"  SELECT * FROM videoSettings" +
			subqueryWhere +
			") AS vp " +
			"INNER JOIN instances ON instances.id = vp.instanceId";
		return enterContext(this._factory, connection, (context) =>
			context.query(Count, query + this.createWhereQuery(gameCode, status, processName, entryPoint)),
		)
			.then((records) => records.map((record) => record.count))
			.then(asOne);
	}

	private createWhereQuery(gameCode?: string, status?: string[], processName?: string, entryPoint?: string): string {
		const expressions: string[] = [];
		if (gameCode) {
			expressions.push(tapper.format("gameCode = ?", [gameCode]));
		}
		if (status) {
			const expression = "status IN (" + status.map((state) => tapper.format("?", [state])).join(", ") + ")";
			expressions.push(expression);
		}
		if (processName && processName !== "%") {
			expressions.push(tapper.format("processName LIKE ?", [processName + "%"]));
		}
		if (entryPoint && entryPoint !== "%") {
			expressions.push(tapper.format("entryPoint LIKE ?", [entryPoint + "%"]));
		}
		return expressions.length === 0 ? "" : " WHERE " + expressions.join(" AND ");
	}
}
