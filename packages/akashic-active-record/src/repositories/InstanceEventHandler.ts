import * as dt from "@akashic/server-engine-data-types";
import * as tapper from "@akashic/tapper";
import { ConnectionFactory } from "../connections/ConnectionFactory";
import { EventHandler as Record } from "../records/EventHandler";
import { InstanceEventHandler as InstanceEventHandlerRecord } from "../records/InstanceEventHandler";
import { asOne, enterContext } from "../utils/RepositoryUtils";

export class InstanceEventHandler {
	private _factory: ConnectionFactory;
	constructor(factory: ConnectionFactory) {
		this._factory = factory;
	}

	/**
	 * イベントハンドラの取得
	 */
	public get(id: string, connection?: tapper.Connection): Promise<dt.EventHandler> {
		return enterContext(this._factory, connection, (context) =>
			context.query(Record, "SELECT * FROM eventHandlers WHERE id = CAST(? AS unsigned)", [id]),
		)
			.then((records) => records.map((record) => record.toEntity()))
			.then(asOne);
	}

	/**
	 * instanceId/type と関連するイベントハンドラを複数取得
	 */
	public getByInstanceId(instanceId: string, type?: string, connection?: tapper.Connection): Promise<dt.EventHandler[]> {
		return enterContext(this._factory, connection, (context) => this.buildInstanceEventHandlerQuery(context, instanceId, type)).then(
			(records) => records.map((record) => record.toEntity()),
		);
	}

	/**
	 * イベントハンドラを保存
	 */
	public save(handler: dt.EventHandler, instanceId?: string, connection?: tapper.Connection): Promise<dt.EventHandler> {
		return enterContext(this._factory, connection, (context) =>
			context
				.execute("INSERT INTO eventHandlers SET " + tapper.escape(Record.fromPatch(handler), false))
				.then((okPacket) => this.get(String(okPacket.insertId), context))
				.then((handler) => {
					if (instanceId) {
						return context
							.execute(
								"INSERT INTO instanceEventHandlers SET " + tapper.escape(new InstanceEventHandlerRecord(instanceId, handler.id), false),
							)
							.then(() => handler);
					}
					return Promise.resolve(handler);
				}),
		);
	}

	/**
	 * イベントハンドラの削除
	 */
	public remove(id: string, connection?: tapper.Connection): Promise<void> {
		return enterContext(this._factory, connection, (context) =>
			context
				.execute("DELETE FROM instanceEventHandlers WHERE eventHandlerId = CAST(? as unsigned)", [id])
				.then(() => context.execute("DELETE FROM eventHandlers WHERE id = CAST(? as unsigned)", [id])),
		).then<void>((_okPacket) => undefined);
	}

	private buildInstanceEventHandlerQuery(context: tapper.Connection, instanceId: string, type?: string, id?: string): Promise<Record[]> {
		let query =
			"SELECT e.id as id, e.type as type, e.endpoint as endpoint, e.protocol as protocol " +
			"from instanceEventHandlers AS ie INNER JOIN eventHandlers AS e ON ie.eventHandlerId = e.id " +
			"WHERE ie.instanceId = CAST(? AS unsigned)";
		const data: string[] = [instanceId];
		if (type) {
			query += " AND e.type = ?";
			data.push(type);
		}
		if (id) {
			query += " AND e.id = CAST(? AS unsigned)";
			data.push(id);
		}
		return context.query(Record, query, data);
	}
}
