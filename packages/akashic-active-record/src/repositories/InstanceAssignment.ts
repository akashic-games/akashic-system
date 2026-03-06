import * as dt from "@akashic/server-engine-data-types";
import * as tapper from "@akashic/tapper";
import { ConnectionFactory } from "../connections/ConnectionFactory";
import { InstanceAssignment as Record } from "../records/InstanceAssignment";
import { Count } from "../records/Systems";
import { asOne, enterContext, getWhereFromClusterIdentities, getWhereFromClusterIdentity } from "../utils/RepositoryUtils";

/**
 * インスタンス割り当て情報
 */
export class InstanceAssignment {
	private _factory: ConnectionFactory;
	constructor(factory: ConnectionFactory) {
		this._factory = factory;
	}
	/**
	 * インスタンス割り当て情報の取得
	 */
	public get(id: string, connection?: tapper.Connection): Promise<dt.InstanceAssignment> {
		return enterContext(this._factory, connection, (context) =>
			context.query(Record, "SELECT * FROM instanceAssignments WHERE id = CAST(? AS unsigned)", [id]),
		)
			.then((records) => records.map((record) => record.toEntity()))
			.then(asOne);
	}
	/**
	 * クラスタに関連するインスタンス割り当て情報の取得
	 */
	public getByIdentity(identity: dt.ClusterIdentityLike, connection?: tapper.Connection): Promise<dt.InstanceAssignment[]> {
		return enterContext(this._factory, connection, (context) =>
			context.query(Record, "SELECT * FROM instanceAssignments " + getWhereFromClusterIdentity(identity)),
		).then((records) => records.map((record) => record.toEntity()));
	}
	/**
	 * クラスタに関連するインスタンス割り当て情報の取得
	 */
	public getByIdentities(identities: dt.ClusterIdentityLike[], connection?: tapper.Connection): Promise<dt.InstanceAssignment[]> {
		return Promise.all(identities.map((identity) => this.getByIdentity(identity, connection))).then((records) =>
			Array.prototype.concat.apply([], records),
		); // flatten
	}
	/**
	 * ゲームに関連するインスタンス割り当て情報の取得
	 */
	public getByGame(gameCode: string, connection?: tapper.Connection): Promise<dt.InstanceAssignment[]> {
		return enterContext(this._factory, connection, (context) =>
			context.query(Record, "SELECT * FROM instanceAssignments WHERE gameCode = ?", [gameCode]),
		).then((records) => records.map((record) => record.toEntity()));
	}
	/**
	 * FQDNからのインスタンス割り当て情報の取得
	 */
	public getByFQDN(fqdn: dt.Fqdn, connection?: tapper.Connection): Promise<dt.InstanceAssignment[]> {
		return this.getByIdentity(
			{
				fqdn,
				type: undefined,
				name: undefined,
				czxid: undefined,
			},
			connection,
		);
	}
	/**
	 * インスタンスからのインスタンス割り当て情報の取得
	 */
	public getByInstanceId(instanceId: string, connection?: tapper.Connection): Promise<dt.InstanceAssignment[]> {
		return enterContext(this._factory, connection, (context) =>
			context.query(Record, "SELECT * FROM instanceAssignments WHERE instanceId = CAST(? AS unsigned)", [instanceId]),
		).then((records) => records.map((record) => record.toEntity()));
	}
	/**
	 * インスタンス割り当て情報の保存
	 */
	public save(instanceAssignment: dt.InstanceAssignment, connection?: tapper.Connection): Promise<dt.InstanceAssignment> {
		return enterContext(this._factory, connection, (context) =>
			context
				.execute("INSERT INTO instanceAssignments SET " + tapper.escape(Record.fromPatch(instanceAssignment), false))
				.then((okPacket) => this.get(String(okPacket.insertId), context)),
		);
	}
	/**
	 * インスタンス割り当て情報の削除
	 */
	public remove(id: string, connection?: tapper.Connection): Promise<void> {
		return enterContext(this._factory, connection, (context) =>
			context.execute("DELETE FROM instanceAssignments WHERE id = CAST(? as unsigned)", [id]),
		).then<void>((_okPacket) => undefined);
	}
	/**
	 * クラスタに関連するインスタンス割り当て情報の削除
	 */
	public removeByIdentity(identity: dt.ClusterIdentityLike, connection?: tapper.Connection): Promise<void> {
		return enterContext(this._factory, connection, (context) =>
			context.execute("DELETE FROM instanceAssignments" + getWhereFromClusterIdentity(identity)),
		).then<void>((_okPacket) => undefined);
	}

	public removeByIdentities(identities: dt.ClusterIdentityLike[], connection?: tapper.Connection): Promise<void> {
		if (identities.length <= 0) {
			return Promise.resolve<void>(undefined);
		}
		return enterContext(this._factory, connection, (context) =>
			context.execute("DELETE FROM instanceAssignments" + getWhereFromClusterIdentities(identities)),
		).then<void>((_okPacket) => undefined);
	}
	/**
	 * identityに存在しないゲーム割り当て情報の取得
	 * 重たいクエリなのでなるべく使わないほうが望ましい。
	 * なお、指定したコネクションに対して結果が返るまで他のクエリを投げてはいけない。
	 *
	 * メモ: プロセス数が数十万オーダになると破綻するおそれがあるが、先にzookeeperが音を上げるので問題が無い。
	 */
	public getNotByIdentities(identities: dt.ClusterIdentity[], connection?: tapper.Connection): Promise<dt.InstanceAssignment[]> {
		const queryString = "SELECT * FROM instanceAssignments";
		return enterContext(
			this._factory,
			connection,
			(context) =>
				new Promise<dt.InstanceAssignment[]>((resolve, reject) => {
					const result: dt.InstanceAssignment[] = [];
					context.bigQuery(Record, queryString).subscribe({
						onNext: (record) => {
							const instanceAssignment = record.toEntity();
							if (identities.some((identity) => identity.isSame(instanceAssignment.targetIdentity))) {
								return;
							}
							result.push(instanceAssignment);
						},
						onError: (err) => reject(err),
						onCompleted: () => resolve(result),
					});
				}),
		);
	}

	public getAll(connection?: tapper.Connection): Promise<dt.InstanceAssignment[]> {
		return enterContext(this._factory, connection, (context) => context.query(Record, "SELECT * FROM instanceAssignments")).then(
			(records) => records.map((record) => record.toEntity()),
		);
	}

	public count(id?: number, game?: string, instanceId?: number, connection?: tapper.Connection): Promise<string> {
		return enterContext(this._factory, connection, (context) =>
			context.query(Count, "SELECT COUNT(*) as count FROM instanceAssignments" + this.getsWhere(id, game, instanceId)),
		)
			.then((records) => records.map((record) => record.count))
			.then(asOne);
	}

	private getsWhere(id?: number, game?: string, instanceId?: number): string {
		const expressions: any[] = [];
		if (id) {
			expressions.push(tapper.format("id = ?", [id]));
		}
		if (game) {
			expressions.push(tapper.format("gameCode = ?", [game]));
		}
		if (instanceId) {
			expressions.push(tapper.format("instanceId = ?", [instanceId]));
		}
		return expressions.length === 0 ? "" : " WHERE " + expressions.join(" AND ");
	}
}
