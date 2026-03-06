import { Report as ReportDataType } from "@akashic/server-engine-data-types";
import * as tapper from "@akashic/tapper";
import { ConnectionFactory } from "../connections/ConnectionFactory";
import { Report as Record } from "../records/Report";
import { Count } from "../records/Systems";
import { RecordOrder } from "../utils/RecordOrders";
import { asOne, enterContext, toPaging } from "../utils/RepositoryUtils";

export interface SearchReportParameter {
	key?: string;
	value?: string;
	date?: {
		begin: Date;
		end: Date;
		order?: RecordOrder;
	};
	paging?: {
		offset: number;
		limit: number;
	};
	connection?: tapper.Connection;
}

/**
 * レポート情報
 */
export class Report {
	private _factory: ConnectionFactory;

	constructor(factory: ConnectionFactory) {
		this._factory = factory;
	}

	/**
	 * レポートの取得
	 */
	public get(id: string, connection?: tapper.Connection): Promise<ReportDataType> {
		return enterContext(this._factory, connection, (context) =>
			context.query(Record, "SELECT * FROM reports WHERE id = CAST(? AS unsigned)", [id]),
		)
			.then((records) => records.map((record) => record.toEntity()))
			.then(asOne);
	}

	/**
	 * レポートの取得(行ロック付き)
	 */
	public getWithLock(id: string, connection?: tapper.Connection): Promise<ReportDataType> {
		return enterContext(this._factory, connection, (context) =>
			context.query(Record, "SELECT * FROM reports WHERE id = CAST(? AS unsigned) FOR UPDATE", [id]),
		)
			.then((records) => records.map((record) => record.toEntity()))
			.then(asOne);
	}

	/**
	 * 指定した条件でレポート情報を検索する
	 */
	public find(parameter: SearchReportParameter): Promise<ReportDataType[]> {
		const offset: number = parameter.paging ? parameter.paging.offset : undefined;
		const limit: number = parameter.paging ? parameter.paging.limit : undefined;
		return enterContext(this._factory, parameter.connection, (context) =>
			context.query(
				Record,
				toPaging("SELECT * FROM reports" + this.getWhere(parameter) + this.getOrderByCreatedAt(parameter), offset, limit),
			),
		).then((records) => records.map((record) => record.toEntity()));
	}

	/**
	 * レポート情報を保存する
	 */
	public save(report: ReportDataType, connection?: tapper.Connection): Promise<ReportDataType> {
		return enterContext(this._factory, connection, (context) =>
			context
				.execute("INSERT INTO reports SET " + tapper.escape(Record.fromPatch(report), false))
				.then((okPacket) => this.get(String(okPacket.insertId), context)),
		);
	}

	/**
	 * レポート件数を取得
	 */
	public count(parameter: SearchReportParameter): Promise<string> {
		return enterContext(this._factory, parameter.connection, (context) =>
			context.query(Count, "SELECT COUNT(*) as count FROM reports" + this.getWhere(parameter)),
		)
			.then((records) => records.map((record) => record.count))
			.then(asOne);
	}

	private getWhere(parameter: SearchReportParameter): string {
		const expressions: string[] = [];
		if (parameter.key) {
			expressions.push(tapper.format("searchKey = ?", [parameter.key]));
		}
		if (parameter.value) {
			expressions.push(tapper.format("searchValue = ?", [parameter.value]));
		}
		if (parameter.date) {
			expressions.push(tapper.format("createdAt BETWEEN = ? AND ?", [parameter.date.begin, parameter.date.end]));
		}
		return expressions.length === 0 ? "" : " WHERE " + expressions.join(" AND ");
	}

	private getOrderByCreatedAt(parameter: SearchReportParameter): string {
		if (!parameter.date) {
			return "";
		}
		const order = parameter.date.order;
		return order ? " ORDER BY createdAt " + order.value : "";
	}
}
