import { LockState } from "./LockState";

export interface IClient {
	/**
	 * プレイログの書き込みロックを取得する
	 * @param playId チェック対象
	 * @param ownerType ロック取得している対象(OWNER_TYPE_*を指定。デバッグ用)
	 */
	acquireLock(playId: string, ownerType: string): Promise<LockState | null>;

	/**
	 * プレイログの書き込みロックを開放する
	 */
	releaseLock(playId: string): Promise<boolean>;
}
