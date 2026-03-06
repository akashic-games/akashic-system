import * as Cast from "@akashic/cast-util";
import * as dt from "@akashic/server-engine-data-types";
import { Annotations } from "@akashic/tapper";

/**
 * プレー情報へのパッチ
 */
export interface PlayPatch {
	/**
	 * プレーID
	 */
	id?: string;
	/**
	 * ゲーム
	 */
	gameCode?: string;
	/**
	 * プレーの派生元ID
	 */
	parentId?: string;
	/**
	 * 作成日時
	 */
	started?: Date;
	/**
	 * 登録日時
	 */
	finished?: Date;
	/**
	 * プレー状態
	 */
	status?: string;
}
/**
 * プレー情報
 */
export class Play {
	/**
	 * パッチ情報からの情報の取得と型チェック
	 */
	public static fromPatch(entity: PlayPatch): Play {
		const result = new Play();
		result.id = Cast.bigint(entity.id, true);
		result.gameCode = Cast.string(entity.gameCode, 64);
		result.parentId = Cast.bigint(entity.parentId, true);
		result.started = Cast.date(entity.started);
		result.finished = Cast.date(entity.finished, true);
		result.status = Cast.string(entity.status, 32);
		return result;
	}
	/**
	 * ID
	 */
	@Annotations.map()
	public id: string;

	@Annotations.map()
	public gameCode: string;

	@Annotations.map()
	public parentId: string;

	@Annotations.map()
	public started: Date;

	@Annotations.map()
	public finished: Date;

	@Annotations.map()
	public status: string;

	public toEntity(): dt.Play {
		return new dt.Play({
			id: this.id,
			gameCode: this.gameCode,
			parentId: this.parentId,
			started: this.started,
			finished: this.finished,
			status: this.status,
		});
	}
}
