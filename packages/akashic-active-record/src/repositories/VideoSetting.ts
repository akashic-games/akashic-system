import * as dt from "@akashic/server-engine-data-types";
import * as tapper from "@akashic/tapper";
import { ConnectionFactory } from "../connections/ConnectionFactory";
import { VideoSetting as Record } from "../records/VideoSetting";
import { asOne, enterContext } from "../utils/RepositoryUtils";

/**
 * 映像設定
 */
export class VideoSetting {
	private _factory: ConnectionFactory;
	constructor(factory: ConnectionFactory) {
		this._factory = factory;
	}
	/**
	 * 映像設定の取得
	 */
	public get(id: string, connection?: tapper.Connection): Promise<dt.VideoSetting> {
		return enterContext(this._factory, connection, (context) =>
			context.query(Record, "SELECT * FROM videoSettings WHERE instanceId = CAST(? AS unsigned)", [id]),
		)
			.then((records) => records.map((record) => record.toEntity()))
			.then(asOne);
	}
	/**
	 * 映像設定の取得
	 */
	public gets(ids?: string[], connection?: tapper.Connection): Promise<dt.VideoSetting[]> {
		return enterContext(this._factory, connection, (context) =>
			context.query(Record, "SELECT * FROM videoSettings" + this.getsWhere(ids)),
		).then((records) => records.map((record) => record.toEntity()));
	}
	/**
	 * 映像設定の保存
	 */
	public save(setting: dt.VideoSetting, connection?: tapper.Connection): Promise<dt.VideoSetting> {
		return enterContext(this._factory, connection, (context) =>
			context
				.execute("INSERT INTO videoSettings SET " + tapper.escape(Record.fromPatch(setting), false))
				.then((_okPacket) => this.get(setting.instanceId, context)),
		);
	}

	private getsWhere(ids?: string[]): string {
		let baseQuery = "";
		if (ids) {
			baseQuery += " WHERE instanceId IN (" + ids.map((id) => tapper.format("CAST(? AS unsigned)", [id])).join(", ") + ")";
		}
		return baseQuery;
	}
}
