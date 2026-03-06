export const tickStoreQueueNamePrefix = "playlog_store_queue_ticks.";
export const startPointStoreQueueNamePrefix = "playlog_store_queue_startpoint.";
export const eventQueueNamePrefix = "playlog_events_queue.";

export const tickStoreDeadLetterQueueName = "playlog_store_dead_letter_queue_ticks";
export const startPointStoreDeadLetterQueueName = "playlog_store_dead_letter_queue_ticks";

export const tickBroadcastExchangeNamePrefix = "playlog_ticks.";
export const tickStoreExchangeNamePrefix = "playlog_ticks_store.";
export const startPointStoreExchangeNamePrefix = "playlog_startpoint_store.";
export const eventExchangeNamePrefix = "playlog_events.";

export const tickDlxName = "playlog_ticks_dlx";
export const startPointDlxName = "playlog_startpoint_dlx";

export const playIdHeaderName = "play-id";

export const EVENT_MAX_PRIORITY = 3;
export const EVENT_NON_MAX_PRIORITY_EVENT_TTL = 1000;

export function getExchangeNames(playId: string) {
	return {
		tickBroadcastExchangeName: tickBroadcastExchangeNamePrefix + playId,
		tickStoreExchangeName: tickStoreExchangeNamePrefix + playId,
		startPointStoreExchangeName: startPointStoreExchangeNamePrefix + playId,
		eventExchangeName: eventExchangeNamePrefix + playId,
	};
}

export function getQueueNames(playId: string) {
	return {
		tickStoreQueueName: tickStoreQueueNamePrefix + playId,
		startPointStoreQueueName: startPointStoreQueueNamePrefix + playId,
		eventQueueName: eventQueueNamePrefix + playId,
	};
}
