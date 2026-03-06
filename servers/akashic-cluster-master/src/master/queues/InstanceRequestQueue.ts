import { TypedEventEmitter } from "../../util/TypedEventEmitter";
import { InstanceRequestQueueEntry } from "../controls/InstanceRequestQueueEntry";
import { InstanceRequestQueueExit } from "../instanceRequests/InstanceRequestQueueExit";
import { InstanceRequestQueueMessage } from "./InstanceRequestQueueMessage";

interface InstanceRequestQueueEventMap {
	message: InstanceRequestQueueMessage;
}

/**
 * 処理を一旦キューに積んで、別の処理を行ってあとから処理するケースで使用するキュー(終了用)
 * これを作った理由は、将来的に「HTTPでゲーム起動リクエストを受け付けてinstanceIdを発行する処理」と「タスクを管理する処理」とのコードベースを分割可能にするため
 */
export class InstanceRequestQueue
	extends TypedEventEmitter<InstanceRequestQueueEventMap>
	implements InstanceRequestQueueEntry, InstanceRequestQueueExit
{
	public enqueue(message: InstanceRequestQueueMessage) {
		setTimeout(() => {
			this.emit("message", message);
		}, 0);
	}
}
