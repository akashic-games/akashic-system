import * as tapper from "@akashic/tapper";
import { ConnectionFactory } from "../connections/ConnectionFactory";
import { PlaysNicoliveMetadata as PlaysNicoliveMetadataRecord } from "../records/PlaysNicoliveMetadata";
import { enterContext } from "../utils/RepositoryUtils";

/**
 * プレーに紐づいた番組の種別情報
 */
export class PlaysNicoliveMetadata {
	private _factory: ConnectionFactory;
	constructor(factory: ConnectionFactory) {
		this._factory = factory;
	}

	/**
	 * プレーに紐づいた番組の種別情報保存
	 */
	public save(playId: string, providerType: string, connection?: tapper.Connection): Promise<void> {
		return enterContext(this._factory, connection, (context) =>
			context.execute(
				"INSERT INTO playsNicoliveMetadata SET " + tapper.escape(PlaysNicoliveMetadataRecord.fromPatch({ playId, providerType }), false),
			),
		).then<void>((_okPacket) => undefined);
	}
}
