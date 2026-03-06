import * as dt from "@akashic/server-engine-data-types";
import * as tapper from "@akashic/tapper";
import { ConnectionFactory } from "../connections/ConnectionFactory";
import { Instance as InstanceRecord } from "../records/Instance";
import { Play as PlayRecord } from "../records/Play";
import { PlaysInstances as PlaysInstancesRecord } from "../records/PlaysInstances";
import { enterContext } from "../utils/RepositoryUtils";

/**
 * プレーとインスタンスの関連情報
 */
export class PlaysInstances {
	private _factory: ConnectionFactory;
	constructor(factory: ConnectionFactory) {
		this._factory = factory;
	}
	/**
	 * プレーに関連するインスタンス情報の取得
	 */
	public getByPlayId(playId: string, connection?: tapper.Connection): Promise<dt.Instance[]> {
		return enterContext(this._factory, connection, (context) =>
			context.query(
				InstanceRecord,
				"SELECT i.id, i.gameCode, i.status, i.region, i.exitCode, i.modules, i.cost, i.processName, i.entryPoint" +
					" FROM  playsInstances as pi, plays as p, instances as i" +
					" WHERE pi.playId = CAST(? AS unsigned)" +
					" AND   pi.playId = p.id" +
					" AND   pi.instanceId = i.id",
				[playId],
			),
		).then((records) => records.map((record) => record.toEntity()));
	}
	/**
	 * インスタンスに関連するプレー情報の取得
	 */
	public getByInstanceId(instanceId: string, connection?: tapper.Connection): Promise<dt.Play[]> {
		return enterContext(this._factory, connection, (context) =>
			context.query(
				PlayRecord,
				"SELECT p.id, p.gameCode, p.parentId, p.started, p.finished, p.status" +
					" FROM  playsInstances as pi, plays as p, instances as i" +
					" WHERE pi.instanceId = CAST(? AS unsigned)" +
					" AND   pi.playId = p.id" +
					" AND   pi.instanceId = i.id",
				[instanceId],
			),
		).then((records) => records.map((record) => record.toEntity()));
	}
	/**
	 * プレーとインスタンスの関連保存
	 */
	public save(playId: string, instanceId: string, connection?: tapper.Connection): Promise<void> {
		return enterContext(this._factory, connection, (context) =>
			context.execute("INSERT INTO playsInstances SET " + tapper.escape(PlaysInstancesRecord.fromPatch({ playId, instanceId }), false)),
		).then<void>((_okPacket) => undefined);
	}
	/**
	 * インスタンス削除に伴う関連の削除
	 */
	public removeByInstanceId(instanceId: string, connection?: tapper.Connection): Promise<void> {
		return enterContext(this._factory, connection, (context) =>
			context.execute("DELETE FROM playsInstances WHERE instanceId = CAST(? as unsigned)", [instanceId]),
		).then<void>((_okPacket) => undefined);
	}
}
