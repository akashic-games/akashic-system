import * as CastUtil from "@akashic/cast-util";
import { Annotations } from "@akashic/tapper";

/**
 * PlaysNicoliveMetadata情報へのパッチ
 */
export interface PlaysNicoliveMetadataPatch {
	playId?: string;
	providerType?: string;
}

export class PlaysNicoliveMetadata {
	public static fromPatch(entity: PlaysNicoliveMetadataPatch): PlaysNicoliveMetadata {
		const result = new PlaysNicoliveMetadata();
		result.playId = CastUtil.bigint(entity.playId);
		result.providerType = CastUtil.string(entity.providerType, 16);
		return result;
	}
	/**
	 * playのID
	 */
	@Annotations.map()
	public playId: string;
	/**
	 * playが紐づく番組のproviderType
	 */
	@Annotations.map()
	public providerType: string;
}
