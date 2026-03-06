import amqp from "amqplib";
import { EventType } from "./EventType";
import { PlayToken } from "./PlayToken";

export class PlayTokenAMQP {
	public static EXCHANGE = "playtokens";

	private _ch: amqp.Channel;

	constructor(ch: amqp.Channel) {
		this._ch = ch;
	}

	public assertExchange(): Promise<{ exchange: string }> {
		const opts = {
			durable: true,
			autoDelete: false,
		};
		return Promise.resolve(this._ch.assertExchange(PlayTokenAMQP.EXCHANGE, "fanout", opts));
	}

	public publish(type: EventType, token: PlayToken): boolean {
		return this.publishRaw(type, Buffer.from(JSON.stringify(token)));
	}

	public publishRaw(type: EventType, content: Buffer): boolean {
		return this._ch.publish(PlayTokenAMQP.EXCHANGE, type.toString(), content);
	}

	public consume(callback: (err: any, type?: EventType, token?: PlayToken, ack?: (err: any) => void) => void): Promise<any> {
		return this.consumeRaw((type: EventType, content: Buffer, ack: (err: any) => void) => {
			try {
				const token = JSON.parse(content.toString()) as PlayToken;
				callback(null, type, token, ack);
			} catch (e) {
				callback(e);
				return;
			}
		});
	}

	public consumeRaw(callback: (type: EventType, content: Buffer, ack: (err: any) => void) => void): Promise<any> {
		return this._assertQueue().then((fields: any) => {
			const queue = fields.queue;
			const opts = {
				noAck: false,
				exclusive: true,
			};

			return this._ch
				.consume(
					queue,
					(msg: amqp.Message | null) => {
						if (!msg) {
							return;
						}

						const eventType = parseInt(msg.fields.routingKey, 10);
						callback(eventType, msg.content, (err: any) => {
							if (err) {
								this._ch.nack(msg);
							} else {
								this._ch.ack(msg);
							}
						});
					},
					opts,
				)
				.then((ok) => {
					// subscribe all messages
					return this._ch.bindQueue(queue, PlayTokenAMQP.EXCHANGE, "").then(() => {
						return ok;
					});
				});
		});
	}

	private _assertQueue(): Promise<any> {
		const opts = {
			exclusive: true,
			autoDelete: true,
		};
		return Promise.resolve(this._ch.assertQueue("", opts));
	}
}
