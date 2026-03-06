import * as dt from "@akashic/server-engine-data-types";
import { Connection, format } from "@akashic/tapper";
import * as mysql from "mysql";
import { ConnectionFactory } from "../connections/ConnectionFactory";
import { Count } from "../records/Systems";

export function enterContext<TResult>(
	factory: ConnectionFactory,
	connection: Connection,
	inContext: (context: Connection) => Promise<TResult>,
): Promise<TResult> {
	if (connection) {
		return inContext(connection);
	}
	return factory.getConnection().then((context) =>
		inContext(context)
			.then((result) => factory.release(context).then(() => result))
			.catch((error) =>
				factory
					.release(context)
					.catch((_e): undefined => undefined) // 切断時のエラーは握りつぶす
					.then(() => Promise.reject(error)),
			),
	);
}

export function asOne<T>(records: T[]): T {
	if (records.length === 0) {
		return null;
	}
	return records[0];
}

export function toPaging(query: string, offset?: number, limit?: number): string {
	if (limit !== undefined && limit !== null) {
		query += " LIMIT " + mysql.escape(limit);
	}
	if (offset !== undefined && offset !== null) {
		if (limit === undefined || limit === null) {
			query += " LIMIT 18446744073709551615";
		}
		query += " OFFSET " + mysql.escape(offset);
	}
	return query;
}

/**
 * 件数の取得.
 * @note number の精度が64bit未満であるため string を返す。
 */
export function count(factory: ConnectionFactory, connection: Connection, from: string, where?: string): Promise<string> {
	return enterContext(factory, connection, (context) => context.query(Count, "SELECT COUNT(*) AS count from " + from + where))
		.then(asOne)
		.then((record) => record.count);
}

function buildExpressionsFromClusterIdentity(identity: { fqdn?: dt.Fqdn; type?: string; name?: string; czxid?: string }): string[] {
	const expressions: string[] = [];
	if (identity.fqdn) {
		expressions.push(format("reverseFqdn = ?", [identity.fqdn.toReverseFQDN()]));
	}
	if (identity.type) {
		expressions.push(format("type = ?", [identity.type]));
	}
	if (identity.name) {
		expressions.push(format("name = ?", [identity.name]));
	}
	if (identity.czxid) {
		expressions.push(format("czxid = CAST(? AS unsigned)", [identity.czxid]));
	}
	return expressions;
}

/**
 * クラスタ条件句の取得
 */
export function getWhereFromClusterIdentity(identity: { fqdn?: dt.Fqdn; type?: string; name?: string; czxid?: string }): string {
	const expressions = buildExpressionsFromClusterIdentity(identity);
	return expressions.length === 0 ? "" : " WHERE " + expressions.join(" AND ");
}

/**
 * クラスタ条件句(複数)の取得
 */
export function getWhereFromClusterIdentities(identities: { fqdn?: dt.Fqdn; type?: string; name?: string; czxid?: string }[]): string {
	const expressions: string[] = [];
	for (const identity of identities) {
		const expression = buildExpressionsFromClusterIdentity(identity);
		if (expression.length > 0) {
			expressions.push("(" + expression.join(" AND ") + ")");
		}
	}
	return expressions.length === 0 ? "" : " WHERE " + expressions.join(" OR ");
}
