import * as amflowMessage from "@akashic/amflow-message";
import * as playlog from "@akashic/playlog";
import * as amqp from "amqplib";

export class Event {
	public static EXCHANGE_PREFIX = "playlog_events";
	public static QUEUE_PREFIX = "playlog_events_queue";
	public static MAX_PRIORITY = 3;
	public static NON_MAX_PRIORITY_EVENT_TTL = 1000;
	public static TRANSIENT_MASK = 0b1000;
	public static IGNORABLE_MASK = 0b10000;
	public static PRIORITY_MASK = 0b0011;

	private _ch: amqp.Channel;

	constructor(ch: amqp.Channel) {
		this._ch = ch;
	}

	public attach(ch: amqp.Channel): void {
		this._ch = ch;
	}

	public channel(): amqp.Channel {
		return this._ch;
	}

	public assertExchange(playId: string): PromiseLike<{ exchange: string }> {
		const opts = {
			durable: false,
			autoDelete: false,
		};
		return Promise.resolve(this._ch.assertExchange(this._createExchangeName(playId), "fanout", opts));
	}

	/**
	 * Assert the persistent queue for each playId into existence.
	 */
	public assertQueue(playId: string): PromiseLike<any> {
		const opts = {
			durable: false,
			autoDelete: false,
			maxPriority: Event.MAX_PRIORITY,
		};
		const queueName = this._createQueueName(playId);
		return this._ch.assertQueue(queueName, opts).then(() => {
			return this._ch.bindQueue(queueName, this._createExchangeName(playId), "");
		});
	}

	public publish(playId: string, ev: playlog.Event): boolean {
		const opts: { priority: number; expiration?: string } = {
			priority: ev[1],
		};
		const priority = opts.priority & Event.PRIORITY_MASK;
		if (priority !== Event.MAX_PRIORITY) {
			opts.expiration = "" + Event.NON_MAX_PRIORITY_EVENT_TTL;
		}
		return this.publishRaw(playId, amflowMessage.encodeEvent(ev), opts);
	}

	public publishRaw(playId: string, content: Buffer, opts: { priority: number; expiration?: string }): boolean {
		return this._ch.publish(this._createExchangeName(playId), "", content, opts);
	}

	/**
	 * Event must be in the persistent queue for each playId.
	 */
	public consume(playId: string, callback: (err: any, ev?: playlog.Event, ack?: (err?: any) => void) => void): PromiseLike<any> {
		return this.consumeRaw(playId, (content, ack) => {
			try {
				const ev = amflowMessage.decodeEvent(content);
				callback(null, ev, ack);
			} catch (e) {
				ack(); // no retry
				callback(e);
				return;
			}
		});
	}

	public consumeRaw(playId: string, callback: (content: Buffer, ack: (err?: any) => void) => void): PromiseLike<any> {
		const queueName = this._createQueueName(playId);
		return this._ch.consume(
			queueName,
			(msg: amqp.ConsumeMessage | null) => {
				if (!msg) {
					return;
				}
				callback(msg.content, (err: any) => {
					if (err) {
						this._ch.nack(msg);
					} else {
						this._ch.ack(msg);
					}
				});
			},
			{ noAck: false },
		);
	}

	public deleteQueue(playId: string): PromiseLike<any> {
		const queueName = this._createQueueName(playId);
		return this._ch.deleteQueue(queueName);
	}

	public deleteExchange(playId: string): PromiseLike<any> {
		const exchangeName = this._createExchangeName(playId);
		return this._ch.deleteExchange(exchangeName);
	}

	public checkQueue(playId: string): PromiseLike<any> {
		const queueName = this._createQueueName(playId);
		return this._ch.checkQueue(queueName);
	}

	public checkExchange(playId: string): PromiseLike<any> {
		const exchangeName = this._createExchangeName(playId);
		return this._ch.checkExchange(exchangeName);
	}

	private _createExchangeName(playId: string): string {
		return Event.EXCHANGE_PREFIX + "." + playId;
	}

	private _createQueueName(playId: string): string {
		return Event.QUEUE_PREFIX + "." + playId;
	}
}
