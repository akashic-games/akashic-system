import * as amflowMessage from "@akashic/amflow-message";
import * as playlog from "@akashic/playlog";
import * as amqp from "amqplib";

export class Tick {
	public static EXCHANGE_PREFIX = "playlog_ticks";

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

	public publish(playId: string, tick: playlog.Tick): boolean {
		return this.publishRaw(playId, amflowMessage.encodeTick(tick));
	}

	public publishRaw(playId: string, content: Buffer): boolean {
		const exchange = this._createExchangeName(playId);
		return this._ch.publish(exchange, "", content);
	}

	public consume(playId: string, callback: (err: any, tick?: playlog.Tick) => void): PromiseLike<any> {
		return this.consumeRaw(playId, (content: Buffer) => {
			try {
				const message = amflowMessage.decodeTick(content);
				callback(null, message);
			} catch (e) {
				callback(e);
				return;
			}
		});
	}

	public consumeRaw(playId: string, callback: (content: Buffer) => void): PromiseLike<any> {
		const exchange = this._createExchangeName(playId);
		return this._assertQueue().then((fields: any) => {
			const queue = fields.queue;
			const opts = {
				noAck: true,
				exclusive: true,
			};
			return this._ch
				.consume(
					queue,
					(msg: amqp.ConsumeMessage | null) => {
						if (!msg) {
							return;
						}

						callback(msg.content);
					},
					opts,
				)
				.then((ok) => {
					return this._ch.bindQueue(queue, exchange, "").then(() => {
						return ok;
					});
				});
		});
	}

	public deleteExchange(playId: string): PromiseLike<any> {
		const exchangeName = this._createExchangeName(playId);
		return this._ch.deleteExchange(exchangeName);
	}

	public checkExchange(playId: string): PromiseLike<any> {
		const exchangeName = this._createExchangeName(playId);
		return this._ch.checkExchange(exchangeName);
	}

	/**
	 * Assert a private queue into existence.
	 * This queue is expected to be used exclusively on each subscriber.
	 */

	private _assertQueue(): PromiseLike<any> {
		const opts = {
			exclusive: true,
			autoDelete: true,
		};
		return Promise.resolve(this._ch.assertQueue("", opts));
	}

	private _createExchangeName(playId: string): string {
		return Tick.EXCHANGE_PREFIX + "." + playId;
	}
}
