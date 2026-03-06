import { context, LoggerAwareTrait } from "@akashic-system/logger";
import { AmqpChannelHolder, AmqpConnection, AmqpConnectionManager } from "@akashic/amqp-utils";
import * as cb from "@akashic/callback-publisher";
import * as amqp from "amqplib";
import { EventEmitter } from "events";

export interface AmqpConsumerConfig {
	url: string | string[];
	user?: string;
	passwd?: string;
}

/**
 * AMQP Consumer.
 * AMQP/Databaseアクセス異常時は内部でリトライなどはせず上位に返す。
 */
export class AmqpConsumer extends LoggerAwareTrait(EventEmitter) {
	private _connectionManager: AmqpConnectionManager;
	private _channelHolder: AmqpChannelHolder;

	constructor(config: AmqpConsumerConfig) {
		super();

		this._connectionManager = new AmqpConnectionManager({
			urls: config.url,
			user: config.user,
			password: config.passwd,
		});
		this._connectionManager.on("connect", (conn: AmqpConnection) => {
			this.logger.info("connected to amqp server: " + conn.url);
		});
		this._connectionManager.on("close", (conn: AmqpConnection) => {
			this.logger.warn("disconnected from amqp server: " + conn.url);
		});
		this._connectionManager.on("channelError", (err: Error) => {
			this.logger.warn("amqp channel error: " + err.message);
		});

		this._channelHolder = new AmqpChannelHolder(this._connectionManager);
		this._channelHolder.on("connect", async () => {
			this._onConnected();
		});
		this._channelHolder.on("close", () => {
			this.logger.warn("instance request consumer disconnected.");
		});
		this._channelHolder.on("unhandledMessage", (cause: any) => {
			this.logger.warn(`can't handle amqp message, cause: ${cause}`);
		});
	}

	public async close(): Promise<void> {
		// close 時に発生したエラーは無視する
		await this._channelHolder.stop().catch((): undefined => undefined);
		await this._connectionManager.close().catch((): undefined => undefined);
	}

	public async open(): Promise<void> {
		const exchangeOpts = {
			durable: true,
			autoDelete: false,
		};
		const queueOpts = {
			exclusive: false,
			autoDelete: false,
		};

		await this._connectionManager.init();
		await this._connectionManager.doChannelTask(async (channel) => {
			await channel.assertExchange(cb.Constants.exchange, "topic", exchangeOpts);
			await channel.assertQueue(cb.Constants.queue, queueOpts);
			await channel.bindQueue(cb.Constants.queue, cb.Constants.exchange, "*");
		});
		await this._channelHolder.start();
	}

	private async _onConnected(): Promise<void> {
		const channel = this._channelHolder.channel;
		await channel.prefetch(1);

		const consumeOpts = {
			noAck: false,
			exclusive: false,
		};
		await channel.consume(
			cb.Constants.queue,
			async (msg: amqp.Message) => {
				try {
					this.emit(msg.fields.routingKey, msg);
				} catch (err) {
					this.logger.error(`error occurred in ${msg.fields.routingKey} listener`, context({ error: err }));
				}
				await channel.ack(msg);
			},
			consumeOpts,
		);
	}
}
