import { InstanceRequestQueueMessage } from "../queues/InstanceRequestQueueMessage";

export interface InstanceRequestQueueExit {
	addListener(event: "message", listener: (message: InstanceRequestQueueMessage) => void): this;
}
