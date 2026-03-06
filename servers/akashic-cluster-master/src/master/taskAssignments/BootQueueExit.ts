import { BootQueueMessage } from "../queues/BootQueueMessage";

export interface BootQueueExit {
	addListener(event: "message", listener: (message: BootQueueMessage) => void): this;
}
