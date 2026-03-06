import { EventEmitter } from "events";
import { WriteLockStatus } from "./WriteLockStatus";

/**
 * ロックの状態変化をイベント通知するクラス
 *
 * 発行されるイベント
 * * released: ロックがリリースされてしまったのでplayLogを書き込んではいけない
 * * unknown: 通信断等でロックがどうなっているか不明。復旧する可能性があるのでplayLogを書き込まずに待機すべし
 * * checked: unknownから復旧した。playLogの書き込みを再開すべし
 */
export class LockState extends EventEmitter {
	private _playId: string;
	private _state: WriteLockStatus;

	constructor(playId: string, initialState: WriteLockStatus) {
		super();
		this._state = initialState;
		this._playId = playId;
	}

	/**
	 * 直前のzookeeperのドライバにより確認されたロックの状態。
	 * ロックの状態は定期的なheartbeatイベントで確認される
	 */
	get state(): WriteLockStatus {
		return this._state;
	}

	/**
	 * 内部用。状態変化を渡す
	 */
	public onStateChanged(writeLockStatus: WriteLockStatus): void {
		if (this._state === writeLockStatus) {
			return;
		}
		const before = this._state;
		this._state = writeLockStatus;
		switch (writeLockStatus) {
			case WriteLockStatus.Free:
				this.emit("released", this._playId); // ロックがリリースされてしまった
				break;
			case WriteLockStatus.Locked:
				if (before === WriteLockStatus.Unknown) {
					this.emit("checked", this._playId); // ロックを再確認した
				} // 接続開始時にはemitしない
				break;
			case WriteLockStatus.Unknown:
				this.emit("unknown", this._playId); // ロックが未確認状態になった
				break;
		}
	}

	/**
	 * 内部用。このオブジェクトでこれ以上の通知が行われない
	 */
	public onEnd(): void {
		this.emit("end", this._playId); // これ以上の情報をこのオブジェクトは送出しない
	}
}
