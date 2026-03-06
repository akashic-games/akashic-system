import * as Cast from "@akashic/cast-util";
import { Annotations } from "@akashic/tapper";

/**
 * プレーとインスタンスの関連情報の更新用パッチ
 */
export interface PlaysInstancesPatch {
	/**
	 * プレーID
	 */
	playId?: string;
	/**
	 * インスタンスID
	 */
	instanceId?: string;
}
/**
 * プレーとインスタンスの関連情報
 */
export class PlaysInstances {
	/**
	 * パッチ情報からの情報の取得と型チェック
	 */
	public static fromPatch(entity: PlaysInstancesPatch): PlaysInstances {
		const result = new PlaysInstances();
		result.playId = Cast.bigint(entity.playId);
		result.instanceId = Cast.bigint(entity.instanceId);
		return result;
	}
	/**
	 * プレーID
	 */
	@Annotations.map()
	public playId: string;
	/**
	 * インスタンスID
	 */
	@Annotations.map()
	public instanceId: string;
}
