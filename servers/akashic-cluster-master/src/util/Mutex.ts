type WaitFunc = () => void;

/**
 * 非同期でのレースコンディションに対応するためのMutexクラス
 */
export class Mutex {
	private _locks = new Map<string, WaitFunc[]>();
	/**
	 * keyを使った排他処理を実施する
	 * @param key 排他処理に使用するキー。同一キーの実行はロックされる
	 * @param inSection 排他処理内となる非同期関数
	 */
	public enterLockSection<T>(key: string, inSection: () => Promise<T>): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			const waitFunc: WaitFunc = () => {
				this.assertLock(key);
				inSection()
					.then(
						(result) => {
							this.onReleaseLock(key);
							return result;
						},
						(error) => {
							this.onReleaseLock(key);
							return Promise.reject(error);
						},
					)
					.then(resolve, reject);
			};
			if (this._locks.has(key)) {
				// 誰かがロック中
				this.enqueueWaitFunc(key, waitFunc);
				return;
			}
			waitFunc(); // ロックが無いので実行
		});
	}
	/**
	 * ロックキューをなければ作成する
	 */
	private assertLock(key: string): void {
		if (!this._locks.has(key)) {
			this._locks.set(key, []);
		}
	}
	/**
	 * ロックの開放待ちキューに、開放時に実行する関数を追加する
	 */
	private enqueueWaitFunc(key: string, waitFunc: WaitFunc): void {
		const waitFuncs = this._locks.get(key);
		waitFuncs.push(waitFunc);
		this._locks.set(key, waitFuncs);
	}
	/**
	 * ロックを開放する
	 * wait状態のリストから一つ取得して次のtickで実行する
	 * waitがなければロックを開放する
	 */
	private onReleaseLock(key: string): void {
		const waitFuncs = this._locks.get(key);
		if (!waitFuncs || waitFuncs.length === 0) {
			this._locks.delete(key);
			return;
		}
		const waitFunc = waitFuncs.shift();
		this._locks.set(key, waitFuncs);
		process.nextTick(waitFunc);
	}
}
/**
 * defaultとして使用するMutexクラス
 */
export let defaultMutex = new Mutex();
