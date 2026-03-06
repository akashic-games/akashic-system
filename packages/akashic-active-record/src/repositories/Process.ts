import * as dt from "@akashic/server-engine-data-types";
import * as tapper from "@akashic/tapper";
import { ConnectionFactory } from "../connections/ConnectionFactory";
import { Fqdn as FqdnRecord } from "../records/Fqdn";
import { Process as Record } from "../records/Process";
import { Count } from "../records/Systems";
import { asOne, enterContext, getWhereFromClusterIdentities, getWhereFromClusterIdentity, toPaging } from "../utils/RepositoryUtils";

/**
 * プロセス情報
 */
export class Process {
	private _factory: ConnectionFactory;
	constructor(factory: ConnectionFactory) {
		this._factory = factory;
	}
	/**
	 * プロセス情報の取得
	 */
	public get(identity: dt.ClusterIdentityLike, connection?: tapper.Connection): Promise<dt.Process[]> {
		return enterContext(this._factory, connection, (context) =>
			context.query(Record, "SELECT * FROM processes" + getWhereFromClusterIdentity(identity)),
		).then((records) => records.map((record) => record.toEntity()));
	}
	/**
	 * プロセス情報の取得
	 */
	public getOne(identity: dt.ClusterIdentityLike, connection?: tapper.Connection): Promise<dt.Process> {
		return this.get(identity, connection).then(asOne);
	}
	/**
	 * クラスタに関連するプロセス情報の取得
	 */
	public gets(identities: dt.ClusterIdentityLike[], connection?: tapper.Connection): Promise<dt.Process[]> {
		return Promise.all(identities.map((identity) => this.get(identity, connection))).then((records) =>
			Array.prototype.concat.apply([], records),
		); // flatten
	}
	/**
	 * 全プロセス情報の取得
	 */
	public getAll(connection?: tapper.Connection): Promise<dt.Process[]> {
		return enterContext(this._factory, connection, (context) => context.query(Record, "SELECT * FROM processes")).then((records) =>
			records.map((record) => record.toEntity()),
		);
	}

	/**
	 * Fqdnをグルーピングして取得
	 */
	public getFqdn(connection?: tapper.Connection): Promise<dt.Fqdn[]> {
		return enterContext(this._factory, connection, (context) =>
			context.query(FqdnRecord, "SELECT reverseFqdn FROM processes GROUP BY reverseFqdn"),
		).then((records) => records.map((record) => record.toEntity()));
	}

	/**
	 * 指定した条件でプロセス情報を検索する
	 */
	public find(fqdn?: string, type?: string, offset?: number, limit?: number, connection?: tapper.Connection): Promise<dt.Process[]> {
		return enterContext(this._factory, connection, (context) =>
			context.query(Record, toPaging("SELECT * FROM processes" + this.getsWhere(fqdn, type), offset, limit)),
		).then((records) => records.map((record) => record.toEntity()));
	}

	/**
	 * プロセス情報の件数を取得
	 */
	public count(fqdn?: string, type?: string, connection?: tapper.Connection): Promise<string> {
		return enterContext(this._factory, connection, (context) =>
			context.query(Count, "SELECT COUNT(*) as count FROM processes" + this.getsWhere(fqdn, type)),
		)
			.then((records) => records.map((record) => record.count))
			.then(asOne);
	}

	/**
	 * プロセス情報の保存/更新
	 */
	public saveOrUpdate(process: dt.Process, connection?: tapper.Connection): Promise<dt.Process> {
		const identity = process.clusterIdentity;
		return enterContext(this._factory, connection, (context) =>
			context
				.execute(
					"INSERT INTO processes SET " +
						tapper.escape(Record.fromPatch(process), false) +
						" ON DUPLICATE KEY UPDATE reverseFqdn = ?, type = ?, name = ?, czxid = ?",
					[identity.fqdn.toReverseFQDN(), identity.type, identity.name, identity.czxid],
				)
				.then(() => this.getOne(identity, context)),
		);
	}
	/**
	 * プロセス情報の削除
	 */
	public remove(identity: dt.ClusterIdentity, connection?: tapper.Connection): Promise<void> {
		return enterContext(this._factory, connection, (context) =>
			context.execute("DELETE FROM processes " + getWhereFromClusterIdentity(identity)).then<void>(() => undefined),
		);
	}
	public removeProcesses(identities: dt.ClusterIdentity[], connection?: tapper.Connection): Promise<void> {
		if (identities.length <= 0) {
			return Promise.resolve<void>(undefined);
		}
		return enterContext(this._factory, connection, (context) =>
			context.execute("DELETE FROM processes " + getWhereFromClusterIdentities(identities)).then<void>(() => undefined),
		);
	}
	/**
	 * プロセス情報の削除
	 */
	public removeByFqdnAndAgentZxid(args: { fqdn: dt.Fqdn; agentZxid: string }, connection?: tapper.Connection): Promise<void> {
		return enterContext(this._factory, connection, (context) =>
			context.execute("DELETE FROM processes WHERE reverseFqdn = ? AND agentZxId = ?", [args.fqdn.toReverseFQDN(), args.agentZxid]),
		).then<void>((_okPacket) => undefined);
	}
	/**
	 * identityに存在しないゲーム割り当て情報の取得
	 * 重たいクエリなのでなるべく使わないほうが望ましい。
	 * なお、指定したコネクションに対して結果が返るまで他のクエリを投げてはいけない。
	 *
	 * メモ: プロセス数が数十万オーダになると破綻するおそれがあるが、先にzookeeperが音を上げるので問題が無い。
	 */
	public getNotByIdentities(identities: dt.ClusterIdentity[], connection?: tapper.Connection): Promise<dt.Process[]> {
		const queryString = "SELECT * FROM processes";
		return enterContext(
			this._factory,
			connection,
			(context) =>
				new Promise<dt.Process[]>((resolve, reject) => {
					const result: dt.Process[] = [];
					context.bigQuery(Record, queryString).subscribe({
						onNext: (record) => {
							const process = record.toEntity();
							if (identities.some((identity) => identity.isSame(process.clusterIdentity))) {
								return;
							}
							result.push(process);
						},
						onError: (err) => reject(err),
						onCompleted: () => resolve(result),
					});
				}),
		);
	}

	private getsWhere(fqdn?: string, type?: string): string {
		const expressions: string[] = [];
		if (fqdn) {
			expressions.push(tapper.format("reverseFqdn = ?", [fqdn]));
		}
		if (type) {
			expressions.push(tapper.format("type = ?", [type]));
		}
		return expressions.length === 0 ? "" : " WHERE " + expressions.join(" AND ");
	}
}
