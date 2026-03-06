import { InstanceRequestQueueMessage } from "../queues/InstanceRequestQueueMessage";

export interface InstanceRequestQueueEntry {
	enqueue(message: InstanceRequestQueueMessage): void;
}
