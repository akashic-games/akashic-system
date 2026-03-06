import type { IClient } from "./Client";
import { LockState } from "./LockState";
import { WriteLockStatus } from "./WriteLockStatus";

/**
 * playlogのロックを取ったふりをするクライアント。
 * 現状、ActiveAEがサーバ側にしか居ないので許容されている
 * zookeeperの代替を探すための一時的な実装
 *
 * TODO: ActiveAEがクライアント側にでるまでに代替実装を用意する
 */
export class NoLockClient implements IClient {
	async acquireLock(playId: string, _ownerType: string): Promise<LockState> {
		return new LockState(playId, WriteLockStatus.Locked);
	}

	async releaseLock(_playId: string): Promise<boolean> {
		return true;
	}
}
