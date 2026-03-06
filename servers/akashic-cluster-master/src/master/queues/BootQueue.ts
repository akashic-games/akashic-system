import { TypedEventEmitter } from "../../util/TypedEventEmitter";
import { BootQueueEntry } from "../controls/BootQueueEntry";
import { BootQueueExit } from "../taskAssignments/BootQueueExit";
import { BootQueueMessage } from "./BootQueueMessage";

interface BootQueueEventMap {
	message: BootQueueMessage;
}

/**
 * 処理を一旦キューに積んで、別の処理を行ってあとから処理するケースで使用するキュー(起動用)
 * これを作った理由は、将来的に「HTTPでゲーム起動リクエストを受け付けてinstanceIdを発行する処理」と「タスクを管理する処理」とのコードベースを分割可能にするため
 */
export class BootQueue extends TypedEventEmitter<BootQueueEventMap> implements BootQueueEntry, BootQueueExit {
	public enqueue(message: BootQueueMessage) {
		setTimeout(() => {
			this.emit("message", message);
		}, 0);
	}
}
