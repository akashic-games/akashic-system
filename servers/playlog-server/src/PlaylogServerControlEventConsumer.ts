import { LogUtil } from "@akashic/log-util";
import * as playTokenAMQP from "@akashic/playtoken-amqp";
import * as amqp from "amqplib";
import config from "config";
import { EventEmitter } from "events";
import { AMQPConnectionFactory } from "./AMQPConnectionFactory";

enum State {
	CLOSED,
	CONNECTING,
	CONNECTED,
}

type PlaylogServerControlEvent = "purge";

export class PlaylogServerControlEventConsumer extends EventEmitter {
	private state: State;
	private connectionFactory: AMQPConnectionFactory;
	private maxConnectionRetry: number;
	private connection: amqp.ChannelModel;
	private channel: amqp.Channel;
	private client: playTokenAMQP.PlayTokenAMQP;
	private logger: LogUtil;

	constructor(connectionFactory: AMQPConnectionFactory, logger: LogUtil) {
		super();
		this.state = State.CLOSED;
		this.connectionFactory = connectionFactory;
		this.maxConnectionRetry = config.has("rabbitmq.maxConnectionRetry") ? config.get<number>("rabbitmq.maxConnectionRetry") : 5;
		this.connection = null;
		this.channel = null;
		this.client = null;
		this.logger = logger;
	}

	public on(event: PlaylogServerControlEvent, listener: (...args: any[]) => void): this {
		return super.on(event, listener);
	}

	public open(): Promise<void> {
		if (this.state === State.CONNECTED || this.state === State.CONNECTING) {
			return Promise.reject(new Error("already opened"));
		}
		return this._connect(0);
	}

	public close(): Promise<void> {
		this.state = State.CLOSED;
		this.removeAllListeners();
		return this._doClose();
	}

	private async _doClose(): Promise<void> {
		const channel = this.channel;
		this.channel = null;
		const connection = this.connection;
		this.connection = null;
		this.client = null;
		try {
			if (channel) {
				channel.removeAllListeners("error");
				channel.removeAllListeners("close");
				await channel.close();
			}
			if (connection) {
				connection.removeAllListeners("error");
				connection.removeAllListeners("close");
				await connection.close();
			}
		} catch (error) {
			// エラーは無視
		}
		return Promise.resolve();
	}

	private _connect(retry: number): Promise<void> {
		this.state = State.CONNECTING;
		if (retry > this.maxConnectionRetry) {
			this.logger.error("give up connecting to amqp servers.");
			return Promise.reject(new Error("connection failed."));
		}
		return this.connectionFactory
			.newConnection()
			.then((connection) => {
				this.connection = connection;
				connection.on("error", (err: any) => {
					this._reconnect("connection error: " + err);
				});
				connection.on("close", () => {
					this._reconnect("connection closed");
				});
				return connection.createChannel();
			})
			.then((channel) => {
				this.channel = channel;
				channel.on("error", (err: any) => {
					this._reconnect("channel error: " + err.stack);
				});
				channel.on("close", () => {
					this._reconnect("channel closed");
				});
				this.client = new playTokenAMQP.PlayTokenAMQP(channel);
				return this.client.assertExchange();
			})
			.then(() => {
				return this.client.consume(this._onMessage.bind(this));
			})
			.then(() => {
				this.state = State.CONNECTED;
			})
			.catch((err) => {
				return this._connect(retry + 1);
			});
	}

	private _reconnect(cause: string): void {
		if (this.state === State.CONNECTING) {
			return;
		}
		this.logger.warn("reconnect amqp for playtoken event, cause: " + cause);
		this.state = State.CONNECTING;
		this._doClose()
			.then(() => {
				return this._connect(0);
			})
			.then(() => {
				this.logger.warn("amqp reconnection for playtoken event");
			})
			.catch((err) => {
				setImmediate(() => {
					throw err;
				});
			});
	}

	private _onMessage(err: any, type: playTokenAMQP.EventType, token: playTokenAMQP.PlayToken, ack: (err?: any) => void): void {
		if (err) {
			// ignore error token
			return ack();
		}
		if (!token) {
			return ack();
		}
		switch (type) {
			case playTokenAMQP.EventType.Purge:
				this.emit("purge", token.playId, ack);
				break;
			default:
				// `type` must be "purge" for now. Support other types when it's required.
				ack();
				break;
		}
	}
}
