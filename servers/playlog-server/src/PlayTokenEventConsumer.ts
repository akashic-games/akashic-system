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

export class PlayTokenEventConsumer extends EventEmitter {
	private _state: State;
	private _connectionFactory: AMQPConnectionFactory;
	private _maxConnectionRetry: number;
	private _connection: amqp.ChannelModel;
	private _channel: amqp.Channel;
	private _client: playTokenAMQP.PlayTokenAMQP;
	private _logger: LogUtil;

	constructor(connectionFactory: AMQPConnectionFactory, logger: LogUtil) {
		super();
		this._state = State.CLOSED;
		this._connectionFactory = connectionFactory;
		this._maxConnectionRetry = config.has("rabbitmq.maxConnectionRetry") ? config.get<number>("rabbitmq.maxConnectionRetry") : 5;
		this._connection = null;
		this._channel = null;
		this._client = null;
		this._logger = logger;
	}

	public open(): Promise<void> {
		if (this._state === State.CONNECTED || this._state === State.CONNECTING) {
			return Promise.reject(new Error("already opened"));
		}
		return this._connect(0);
	}

	public close(): Promise<void> {
		this._state = State.CLOSED;
		this.removeAllListeners();
		return this._doClose();
	}

	private _doClose(): Promise<void> {
		const channel = this._channel;
		this._channel = null;
		const connection = this._connection;
		this._connection = null;
		this._client = null;
		return Promise.resolve()
			.then(() => {
				if (channel) {
					channel.removeAllListeners("error");
					channel.removeAllListeners("close");
					return channel.close();
				}
			})
			.catch((err) => {
				// エラーは無視
			})
			.then(() => {
				if (connection) {
					connection.removeAllListeners("error");
					connection.removeAllListeners("close");
					return connection.close();
				}
			})
			.catch((err) => {
				// エラーは無視
			});
	}

	private _connect(retry: number): Promise<void> {
		this._state = State.CONNECTING;
		if (retry > this._maxConnectionRetry) {
			this._logger.error("give up connecting to amqp servers.");
			return Promise.reject(new Error("connection failed."));
		}
		return this._connectionFactory
			.newConnection()
			.then((connection) => {
				this._connection = connection;
				connection.on("error", (err: any) => {
					this._reconnect("connection error: " + err);
				});
				connection.on("close", () => {
					this._reconnect("connection closed");
				});
				return connection.createChannel();
			})
			.then((channel) => {
				this._channel = channel;
				channel.on("error", (err: any) => {
					this._reconnect("channel error: " + err.stack);
				});
				channel.on("close", () => {
					this._reconnect("channel closed");
				});
				this._client = new playTokenAMQP.PlayTokenAMQP(channel);
				return this._client.assertExchange();
			})
			.then(() => {
				return this._client.consume(this._onMessage.bind(this));
			})
			.then(() => {
				this._state = State.CONNECTED;
			})
			.catch((err) => {
				return this._connect(retry + 1);
			});
	}

	private _reconnect(cause: string): void {
		if (this._state === State.CONNECTING) {
			return;
		}
		this._logger.warn("reconnect amqp for playtoken event, cause: " + cause);
		this._state = State.CONNECTING;
		this._doClose()
			.then(() => {
				return this._connect(0);
			})
			.then(() => {
				this._logger.warn("amqp reconnection for playtoken event");
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
			case playTokenAMQP.EventType.Revoke:
				this.emit("revoke", token, ack);
				break;
			case playTokenAMQP.EventType.UpdatePermission:
				this.emit("updatePermission", token, ack);
				break;
			default:
				ack();
				break;
		}
	}
}
