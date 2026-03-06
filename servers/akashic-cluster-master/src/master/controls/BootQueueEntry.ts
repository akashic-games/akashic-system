import { BootQueueMessage } from "../queues/BootQueueMessage";

export interface BootQueueEntry {
	enqueue(message: BootQueueMessage): void;
}
