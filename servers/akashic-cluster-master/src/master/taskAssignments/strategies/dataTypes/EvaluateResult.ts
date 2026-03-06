import { BootQueueMessage } from "../../../queues/BootQueueMessage";
import { Requirement } from "./Requirement";

/**
 * コスト推定結果
 */
export class EvaluateResult {
	private _message: BootQueueMessage;
	private _requirement: Requirement;
	/**
	 * 割り当てメッセージ
	 */
	get message() {
		return this._message;
	}
	/**
	 * 実行に必要なプロセス
	 */
	get requirement() {
		return this._requirement;
	}
	constructor(message: BootQueueMessage, requirement: Requirement) {
		this._message = message;
		this._requirement = requirement;
	}
	public toJSON() {
		return {
			message: this._message,
			requirements: this._requirement,
		};
	}
}
