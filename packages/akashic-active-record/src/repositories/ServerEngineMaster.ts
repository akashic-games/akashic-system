import * as dt from "@akashic/server-engine-data-types";
import * as tapper from "@akashic/tapper";
import { ConnectionFactory } from "../connections/ConnectionFactory";
import { Process as Record } from "../records/Process";
import { enterContext } from "../utils/RepositoryUtils";

/**
 * ServerEngineMasterで使うリソースに当てはめできないタイプのクエリ(JOIN)用リポジトリ
 */
export class ServerEngineMaster {
	private _factory: ConnectionFactory;
	constructor(factory: ConnectionFactory) {
		this._factory = factory;
	}
	/**
	 * 現在ゲームが割り当てられていないプロセスを取得
	 */
	public getNoGameAssignedProcess(connection?: tapper.Connection): Promise<dt.Process[]> {
		const sql =
			"SELECT * FROM processes WHERE NOT EXISTS (" +
			"SELECT * FROM instanceAssignments WHERE" +
			" processes.reverseFqdn = instanceAssignments.reverseFqdn AND" +
			" processes.type = instanceAssignments.type AND" +
			" processes.name = instanceAssignments.name AND" +
			" processes.czxid = instanceAssignments.czxid" +
			")";
		return enterContext(this._factory, connection, (context) => context.query(Record, sql)).then((records) =>
			records.map((record) => record.toEntity()),
		);
	}
}
