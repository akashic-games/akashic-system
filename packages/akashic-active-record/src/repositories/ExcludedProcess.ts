import * as dt from "@akashic/server-engine-data-types";
import * as tapper from "@akashic/tapper";
import { ConnectionFactory } from "../connections/ConnectionFactory";
import { ProcessIdentity as Record } from "../records/ProcessIdentity";
import { asOne, enterContext } from "../utils/RepositoryUtils";

/**
 * 割当除外プロセス (クラスタメンテナンス用)
 */
export class ExcludedProcess {
	private _factory: ConnectionFactory;
	constructor(factory: ConnectionFactory) {
		this._factory = factory;
	}
	/**
	 * 割当除外プロセスの取得
	 */
	public get(process: dt.ProcessIdentity, connection?: tapper.Connection): Promise<dt.ProcessIdentity> {
		return enterContext(this._factory, connection, (context) =>
			context
				.query(Record, "SELECT * FROM excludedProcesses WHERE reverseFqdn = ? AND type = ? AND name = ?", [
					process.fqdn.toReverseFQDN(),
					process.type,
					process.name,
				])
				.then((records) => records.map((record) => record.toEntity()))
				.then(asOne),
		);
	}
	/**
	 * 全ての割当除外プロセスの取得
	 */
	public getAll(connection?: tapper.Connection): Promise<dt.ProcessIdentity[]> {
		return enterContext(this._factory, connection, (context) => context.query(Record, "SELECT * FROM excludedProcesses")).then((records) =>
			records.map((record) => record.toEntity()),
		);
	}
	/**
	 * 割り当て除外プロセスの追加
	 */
	public save(process: dt.ProcessIdentity, connection?: tapper.Connection): Promise<dt.ProcessIdentity> {
		return enterContext(this._factory, connection, (context) =>
			context
				.execute("INSERT INTO excludedProcesses SET " + tapper.escape(Record.fromPatch(process), false))
				.then((_okPacket) => this.get(process, connection)),
		);
	}
	/**
	 * 割り当て除外プロセスの削除
	 */
	public remove(process: dt.ProcessIdentity, connection?: tapper.Connection): Promise<void> {
		return enterContext(this._factory, connection, (context) =>
			context
				.execute("DELETE FROM excludedProcesses WHERE reverseFqdn = ? AND type = ? AND name = ?", [
					process.fqdn.toReverseFQDN(),
					process.type,
					process.name,
				])
				.then<void>(() => undefined),
		);
	}
}
