import { BootQueueMessage } from "../../../queues/BootQueueMessage";
import { TaskAssignmentTarget } from "./TaskAssignmentTarget";

/**
 * 割り当て対象の探索結果
 */
export class SearchResult {
	private _message: BootQueueMessage;
	private _score: number;
	private _target: TaskAssignmentTarget;

	get score() {
		return this._score;
	}
	get message() {
		return this._message;
	}
	get target() {
		return this._target;
	}
	constructor(target: TaskAssignmentTarget, score: number, message: BootQueueMessage) {
		this._target = target;
		this._score = score;
		this._message = message;
	}
}
