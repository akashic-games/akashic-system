import * as Cast from "@akashic/cast-util";
import { EventHandler as Model } from "@akashic/server-engine-data-types";
import { Annotations } from "@akashic/tapper";

export interface EventHandlerPatch {
	id?: string;
	type?: string;
	endpoint?: string;
	protocol?: string;
}

export class EventHandler {
	/**
	 * パッチ情報からの情報の取得と型チェック
	 */
	public static fromPatch(entity: EventHandlerPatch): EventHandler {
		const result = new EventHandler();
		result.id = Cast.bigint(entity.id, true);
		result.type = Cast.string(entity.type, 32);
		result.endpoint = Cast.string(entity.endpoint, 512);
		result.protocol = Cast.string(entity.protocol, 32);
		return result;
	}
	@Annotations.map()
	public id: string;

	@Annotations.map()
	public type: string;

	@Annotations.map()
	public endpoint: string;

	@Annotations.map()
	public protocol: string;

	public toEntity(): Model {
		return new Model(this);
	}
}
