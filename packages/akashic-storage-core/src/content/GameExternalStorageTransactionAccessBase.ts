import {
	GameExternalStorageTransactionLockRequest,
	GameExternalStorageTransactionProcessLike,
	StorageTransactionError,
	GameExternalStorageTransactionRequest,
	GameExternalStorageLike,
} from "@akashic/content-storage-types";

import { GameExternalStorageDataAccessBase } from "./GameExternalStorageDataAccessBase";

/**
 * コンテンツストレージのトランザクション処理を行う
 */
export abstract class GameExternalStorageTransactionAccessBase
	extends GameExternalStorageDataAccessBase
	implements GameExternalStorageLike, GameExternalStorageTransactionProcessLike
{
	protected readonly txKey: string;
	protected readonly isTransaction: boolean;

	constructor(txKey: string = "", isTransaction: boolean = false) {
		super();
		this.txKey = txKey;
		this.isTransaction = isTransaction;
	}

	beginTransaction(
		req: GameExternalStorageTransactionRequest,
		callback: (error: Error | null, tx: GameExternalStorageTransactionProcessLike) => void,
	): void {
		(async () => {
			await this.doBeginTransaction(req, callback);
		})();
	}

	lock(req: GameExternalStorageTransactionLockRequest, callback: (error: Error | null) => void): void {
		(async () => {
			await this.doLock(req, callback);
		})();
	}
	commit(callback: (error: StorageTransactionError | null) => void): void {
		(async () => {
			await this.doCommit(callback);
		})();
	}
	rollback(callback: (error: Error | null) => void): void {
		(async () => {
			await this.doRollback(callback);
		})();
	}

	protected async doBeginTransaction(req: GameExternalStorageTransactionRequest, callback: (error: any, tx: any) => void): Promise<void> {
		try {
			if (!req) {
				throw new TypeError("req is empty.");
			}

			if (this.isTransaction) {
				throw new Error("the transaction has already begun.");
			}

			const txKey = this.createStorageKeyPrefix(req);
			callback(null, await this.storageTransaction(txKey));
			return;
		} catch (error: any) {
			callback(error, null);
			return;
		}
	}

	protected async doLock(req: GameExternalStorageTransactionLockRequest, callback: (err: Error | null) => void) {
		try {
			if (!req) {
				throw new TypeError("req is empty.");
			}

			const watchKeys: string[] = [];
			for (const lockKey of req.lockKeys) {
				const lockTxKey = this.createStorageKeyPrefix(lockKey);
				if (
					lockTxKey !== this.txKey ||
					(lockKey.type !== "ordered-number" && lockKey.playerId == null) ||
					(lockKey.type === "ordered-number" && lockKey.playerId)
				) {
					throw new TypeError("invalid lock storage parameter.");
				}

				const storageKey: string = this.createStorageKey(lockKey);
				if (lockKey.type === "ordered-number") {
					watchKeys.push(storageKey);
				} else {
					watchKeys.push(`${storageKey}:${lockKey.playerId}`);
				}
			}

			await this.storageWatch(watchKeys);
			callback(null);
			return;
		} catch (error: any) {
			callback(error);
			return;
		}
	}

	protected async doCommit(callback: (err: StorageTransactionError | null) => void) {
		try {
			await this.storageExec();
			callback(null);
			return;
		} catch (error: any) {
			// error.nameフィールドにトランザクション失敗の種別を設定
			if (error.message && error.message.startsWith("[LockedKeyModifiedError]")) {
				error.name = "LockedKeyModifiedError";
			} else {
				error.name = "UnexpectedError";
			}

			callback(error);
			return;
		}
	}

	protected async doRollback(callback: (err: Error | null) => void) {
		try {
			await this.storageDiscard();
			callback(null);
			return;
		} catch (error: any) {
			callback(error);
			return;
		}
	}

	protected abstract storageWatch(watchKeys: string[]): Promise<void>;
	protected abstract storageExec(): Promise<void>;
	protected abstract storageDiscard(): Promise<void>;
	protected abstract storageTransaction(key: string): Promise<GameExternalStorageTransactionProcessLike>;
}
