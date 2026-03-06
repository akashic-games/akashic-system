import * as amflowMessage from "@akashic/amflow-message";
import { LogUtil } from "@akashic/log-util";
import * as playlog from "@akashic/playlog";
import * as playlogAMQP from "@akashic/playlog-amqp";
import type { IPlaylogStore } from "@akashic/akashic-system";
import * as amqp from "amqplib";
import config from "config";
import { EventEmitter } from "events";
import { AMQPConnectionFactory } from "./AMQPConnectionFactory";
import * as writeLock from "./PlaylogWriteLock";
import { TickCache, TickCacheManager } from "./TickCache";

enum State {
	CLOSED,
	CONNECTING,
	CONNECTED,
}

class AMQPHolder extends EventEmitter {
	public state: State;
	public playId: string;
	public connectionFactory: AMQPConnectionFactory;
	public connection: amqp.ChannelModel;
	public maxConnectionRetry: number;
	public channel: amqp.Channel;
	public eventClient: playlogAMQP.Event;
	public tickClient: playlogAMQP.Tick;
	public tickCache: TickCache;
	public consumeTickStarted: boolean;
	public consumeTickTag: string;
	public consumeEventStarted: boolean;
	public consumeEventTag: string;
	public eventHandlers: ((event: Buffer) => void)[];
	public tickHandlers: ((tick: Buffer) => void)[];
	public prefetchTimer: ReturnType<typeof setInterval>;
	public prefetchCount: number;
	public prefetchInterval: number;
	public pendingEvents: playlog.Event[];
	public pendingTicks: Buffer[];
	public logger: LogUtil;
	constructor(
		playId: string,
		tickCache: TickCache,
		connectionFactory: AMQPConnectionFactory,
		prefetchCount: number,
		prefetchInterval: number,
		logger: LogUtil,
	) {
		super();
		this.state = State.CLOSED;
		this.playId = playId;
		this.connectionFactory = connectionFactory;
		this.maxConnectionRetry = config.has("rabbitmq.maxConnectionRetry") ? config.get<number>("rabbitmq.maxConnectionRetry") : 5;
		this.connection = null;
		this.channel = null;
		this.eventClient = null;
		this.tickClient = null;
		this.tickCache = tickCache;
		this.consumeTickStarted = false;
		this.consumeTickTag = null;
		this.consumeEventStarted = false;
		this.consumeEventTag = null;
		this.eventHandlers = [];
		this.tickHandlers = [];
		this.prefetchTimer = null;
		this.prefetchCount = prefetchCount;
		this.prefetchInterval = prefetchInterval;
		this.pendingEvents = [];
		this.pendingTicks = [];
		this.logger = logger;
	}
	public destroy(): void {
		this.state = State.CLOSED;
		this.playId = null;
		this.channel = null;
		this.eventClient = null;
		this.tickClient = null;
		this.tickCache = null; // destroy()の呼び出しは参照側（RequestHandler）に任せる
		this.consumeTickStarted = false;
		this.consumeTickTag = null;
		this.consumeEventStarted = false;
		this.consumeEventTag = null;
		this.eventHandlers = null;
		this.tickHandlers = null;
		this.prefetchTimer = null;
		this.prefetchCount = null;
		this.prefetchInterval = null;
		this.pendingEvents = null;
		this.pendingTicks = null;
		this.removeAllListeners("error");
	}
	public prepare(): Promise<AMQPHolder> {
		if (this.state === State.CONNECTED || this.state === State.CONNECTING) {
			return Promise.reject<AMQPHolder>(new Error("already prepared"));
		}
		return this._connect(0).then(() => {
			return this;
		});
	}
	public close(): Promise<AMQPHolder> {
		this.state = State.CLOSED;
		return this._doClose().then(() => {
			return this;
		});
	}
	public publishEvent(event: playlog.Event): void {
		if (this.state !== State.CONNECTED) {
			this.pendingEvents.push(event);
			return;
		}
		try {
			this.eventClient.publish(this.playId, event);
		} catch (err) {
			this.pendingEvents.push(event);
			this._reconnect("publish event failed");
		}
	}
	public publishTick(tick: Buffer): void {
		if (this.state !== State.CONNECTED) {
			this.pendingTicks.push(tick);
			return;
		}
		try {
			this.tickClient.publishRaw(this.playId, tick);
		} catch (err) {
			this.pendingTicks.push(tick);
			this._reconnect("publish tick failed");
		}
	}
	public consumeEvent(): PromiseLike<AMQPHolder> {
		this.consumeEventStarted = true;
		if (this.state !== State.CONNECTED) {
			return Promise.resolve(this);
		}
		if (!this.consumeEventTag) {
			return this._doConsumeEvent().then(() => this);
		} else {
			return Promise.resolve(this);
		}
	}
	public consumeTick(): Promise<AMQPHolder> {
		this.consumeTickStarted = true;
		if (this.state !== State.CONNECTED) {
			return Promise.resolve(this);
		}
		if (!this.consumeTickTag) {
			return this._doConsumeTick().then(() => this) as Promise<any>;
		} else {
			return Promise.resolve(this);
		}
	}
	public cancelConsume(): Promise<AMQPHolder> {
		return Promise.all([this.cancelConsumeEvent(), this.cancelConsumeTick()]).then(() => {
			return this;
		});
	}
	public cancelConsumeEvent(): Promise<AMQPHolder> {
		if (!this.consumeEventStarted) {
			return Promise.resolve(this);
		}
		this.consumeEventStarted = false;
		if (this.consumeEventTag) {
			return this.channel.cancel(this.consumeEventTag).then(() => {
				this.consumeEventTag = null;
				return this;
			});
		} else {
			return Promise.resolve(this);
		}
	}
	public cancelConsumeTick(): Promise<AMQPHolder> {
		if (!this.consumeTickStarted) {
			return Promise.resolve(this);
		}
		this.consumeTickStarted = false;
		if (this.consumeTickTag) {
			return this.channel.cancel(this.consumeTickTag).then(() => {
				this.consumeTickTag = null;
				return this;
			});
		} else {
			return Promise.resolve(this);
		}
	}
	public fireEventHandler(event: Buffer): AMQPHolder {
		const handlers = this.eventHandlers;
		for (let i = 0; i < handlers.length; i++) {
			try {
				handlers[i](event);
			} catch (error) {
				const err = error as Error;
				this.logger.warnWithAux("exception occured in event handler: %s", { playId: this.playId }, err.stack || err.message || err);
			}
		}
		return this;
	}
	public addEventHandler(handler: (event: Buffer) => void): AMQPHolder {
		const idx = this.eventHandlers.indexOf(handler);
		if (idx === -1) {
			this.eventHandlers.push(handler);
		}
		return this;
	}
	public removeEventHandler(handler: (event: Buffer) => void): AMQPHolder {
		const handlers = this.eventHandlers;
		this.eventHandlers = [];
		for (let i = 0; i < handlers.length; i++) {
			if (handlers[i] !== handler) {
				this.eventHandlers.push(handlers[i]);
			}
		}
		return this;
	}
	public fireTickHandler(tick: Buffer): AMQPHolder {
		const handlers = this.tickHandlers;
		for (let i = 0; i < handlers.length; i++) {
			try {
				handlers[i](tick);
			} catch (error) {
				const err = error as Error;
				this.logger.warnWithAux("exception occured in tick handler: %s", { playId: this.playId }, err.stack || err.message || err);
			}
		}
		return this;
	}
	public addTickHandler(handler: (tick: Buffer) => void): AMQPHolder {
		const idx = this.tickHandlers.indexOf(handler);
		if (idx === -1) {
			this.tickHandlers.push(handler);
		}
		return this;
	}
	public removeTickHandler(handler: (tick: Buffer) => void): AMQPHolder {
		const handlers = this.tickHandlers;
		this.tickHandlers = [];
		for (let i = 0; i < handlers.length; i++) {
			if (handlers[i] !== handler) {
				this.tickHandlers.push(handlers[i]);
			}
		}
		return this;
	}
	public _connect(retry: number, prevError?: Error): Promise<void> {
		this.state = State.CONNECTING;
		if (retry > this.maxConnectionRetry) {
			const err = prevError || new Error("amqp connection failed.");
			this.emit("error", err);
			return Promise.reject(err);
		}
		const playId = this.playId;
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
					this._reconnect("channel error: " + err);
				});
				channel.on("close", () => {
					this._reconnect("channel closed");
				});
				this.eventClient = new playlogAMQP.Event(channel);
				this.tickClient = new playlogAMQP.Tick(channel);
				return channel.prefetch(this.prefetchCount);
			})
			.then(() => {
				return this.eventClient.checkExchange(playId);
			})
			.then(() => {
				return this.eventClient.checkQueue(playId);
			})
			.then(() => {
				return this.tickClient.checkExchange(playId);
			})
			.then(() => {
				return this.consumeEventStarted ? this._doConsumeEvent() : undefined;
			})
			.then(() => {
				return this.consumeTickStarted ? this._doConsumeTick() : undefined;
			})
			.then(() => {
				while (this.pendingEvents.length) {
					this.eventClient.publish(this.playId, this.pendingEvents[0]);
					this.pendingEvents.shift();
				}
				while (this.pendingTicks.length) {
					this.tickClient.publishRaw(this.playId, this.pendingTicks[0]);
					this.pendingTicks.shift();
				}
				this.state = State.CONNECTED;
			})
			.catch((err) => {
				return this._doClose()
					.catch((err) => {
						/* 切断時のエラーは無視 */
					})
					.then(() => {
						return this._connect(retry + 1, err);
					});
			});
	}
	public _doClose(): Promise<void> {
		if (this.prefetchTimer) {
			clearInterval(this.prefetchTimer);
		}
		this.prefetchTimer = null;
		const connection = this.connection;
		this.connection = null;
		const channel = this.channel;
		this.channel = null;
		this.eventClient = null;
		this.tickClient = null;
		this.consumeTickTag = null;
		this.consumeEventTag = null;
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
	public _reconnect(cause: string): void {
		if (this.state === State.CONNECTING) {
			return;
		}
		this.logger.warnWithAux("reconnect amqp for playlog, cause: " + cause, { playId: this.playId });
		this.state = State.CONNECTING;
		this._doClose()
			.then(() => {
				return this._connect(0);
			})
			.then(() => {
				this.logger.warnWithAux("amqp reconnection for playlog done", { playId: this.playId });
			})
			.catch((err) => {
				// 再接続失敗時は _connect() 内で "error" が emit される
				// ここではなにもしない
			});
	}
	public _doConsumeEvent(): PromiseLike<void> {
		const playId = this.playId;
		return this.eventClient
			.consumeRaw(playId, (data, ack) => {
				this.fireEventHandler(data);
				if (!this.prefetchInterval) {
					ack();
				}
			})
			.then((ok) => {
				if (this.prefetchInterval) {
					this.prefetchTimer = setInterval(() => {
						if (this.channel) {
							try {
								this.channel.ackAll();
							} catch (err) {
								this._reconnect("ackAll failed");
							}
						}
					}, this.prefetchInterval);
				}
				this.consumeEventTag = ok.consumerTag;
			});
	}
	public _doConsumeTick(): PromiseLike<void> {
		const playId = this.playId;
		return this.tickClient
			.consumeRaw(playId, (data: Buffer) => {
				this.tickCache.add(data);
				this.fireTickHandler(data);
			})
			.then((ok) => {
				this.consumeTickTag = ok.consumerTag;
			});
	}
}

export class PlaylogHandler {
	private _writeLockClient: writeLock.IClient;
	private _writeLocks: { [playId: string]: writeLock.LockState };

	private _playlogStore: IPlaylogStore;
	private _tickCacheManager: TickCacheManager;
	private _publishBuffers: { [playId: string]: (() => void)[] };

	private _amqpConnectionFactory: AMQPConnectionFactory;
	private _amqpHolders: { [playId: string]: AMQPHolder };
	private _clients: { [playId: string]: any[] };

	private _prefetchCount: number;
	private _prefetchInterval: number;

	private _logger: LogUtil;

	constructor(
		amqpConnectionFactory: AMQPConnectionFactory,
		playlogStore: IPlaylogStore,
		tickCacheManager: TickCacheManager,
		writeLockClient: writeLock.IClient,
		prefetchCount: number,
		prefetchInterval: number,
		logger: LogUtil,
	) {
		this._playlogStore = playlogStore;
		this._tickCacheManager = tickCacheManager;
		this._writeLockClient = writeLockClient;
		this._writeLocks = {};
		this._publishBuffers = {};

		this._amqpConnectionFactory = amqpConnectionFactory;
		this._amqpHolders = {};
		this._clients = {};
		this._prefetchCount = prefetchCount;
		this._prefetchInterval = prefetchInterval;
		this._logger = logger;
	}

	public prepare(playId: string, client: any): Promise<void> {
		if (!this._clients[playId]) {
			this._clients[playId] = [];
		}
		this._clients[playId].push(client);
		if (this._amqpHolders[playId]) {
			return Promise.resolve();
		} else {
			const holder = new AMQPHolder(
				playId,
				this._tickCacheManager.getCache(playId),
				this._amqpConnectionFactory,
				this._prefetchCount,
				this._prefetchInterval,
				this._logger,
			);
			holder.once("error", (err: Error) => {
				this._logger.warn("amqp connection for playId %s end with error: %s", playId, err.message || err);
				holder.destroy();
				delete this._amqpHolders[playId];
			});
			this._amqpHolders[playId] = holder;
			return holder.prepare().then(() => undefined);
		}
	}

	public close(playId: string, client: any): Promise<void> {
		if (!this._clients[playId]) {
			return Promise.resolve();
		}
		const clientIdx = this._clients[playId].indexOf(client);
		if (clientIdx !== -1) {
			this._clients[playId].splice(clientIdx, 1);
		}
		if (!this._clients[playId].length) {
			delete this._clients[playId];
			const holder = this._amqpHolders[playId];
			if (!holder) {
				return Promise.resolve();
			}
			delete this._amqpHolders[playId];
			return holder
				.cancelConsume()
				.then(() => {
					return holder.close();
				})
				.then(() => {
					holder.destroy();
					// returns void
				});
		}
		return Promise.resolve();
	}

	public cleanup(): Promise<void> {
		return this.cancelConsumeAll().then(() => {
			const tasks: Promise<void>[] = [];
			Object.keys(this._amqpHolders).forEach((playId) => {
				tasks.push(
					new Promise<void>((resolve) => {
						const holder = this._amqpHolders[playId];
						delete this._amqpHolders[playId];
						holder.close().then(() => {
							holder.destroy();
							resolve();
						});
					}),
				);
			});
			return Promise.all(tasks).then(() => {
				// returns void
			});
		});
	}

	public cancelConsumeAll(): Promise<void> {
		const tasks: Promise<any>[] = [];
		Object.keys(this._amqpHolders).forEach((playId) => {
			tasks.push(this._amqpHolders[playId].cancelConsume());
		});
		return Promise.all(tasks).then(() => {
			// returns void
		});
	}

	// playlog-serverはtickを横流しするだけなので、Bufferでよい
	public consumeTick(playId: string, handler: (tick: Buffer) => void): Promise<void> {
		const holder = this._amqpHolders[playId];
		if (!holder) {
			return Promise.reject(new Error("consumeTick for " + playId + " failed, no amqp connection"));
		}
		holder.addTickHandler(handler);
		return holder.consumeTick().then(() => {
			// returns void
		});
	}

	public offConsumeTick(playId: string, handler: (tick: Buffer) => void): PromiseLike<void> {
		const holder = this._amqpHolders[playId];
		if (!holder) {
			// 切断状態なので何もしない
			return Promise.resolve();
		}
		holder.removeTickHandler(handler);
		if (!holder.tickHandlers.length) {
			return holder
				.cancelConsumeTick()
				.then(() => {
					// returns void
				})
				.catch((err) => {
					// 処理中の close によるエラーは無視する
					if (holder.state !== State.CLOSED) {
						return Promise.reject(err);
					}
				});
		} else {
			return Promise.resolve();
		}
	}

	public cancelConsumeTick(playId: string): PromiseLike<void> {
		const holder = this._amqpHolders[playId];
		if (!holder) {
			// 切断状態なので何もしない
			return Promise.resolve();
		}
		return holder
			.cancelConsumeTick()
			.then(() => {
				// returns void
			})
			.catch((err) => {
				// 処理中の close によるエラーは無視する
				if (holder.state !== State.CLOSED) {
					return Promise.reject(err);
				}
			});
	}

	public consumeEvent(playId: string, handler: (event: Buffer) => void): PromiseLike<void> {
		const holder = this._amqpHolders[playId];
		if (!holder) {
			return Promise.reject(new Error("consumeEvent for " + playId + " failed, no amqp connection"));
		}
		holder.addEventHandler(handler);
		return holder.consumeEvent().then(() => {
			// returns void
		});
	}

	public offConsumeEvent(playId: string, handler: (event: Buffer) => void): Promise<void> {
		const holder = this._amqpHolders[playId];
		if (!holder) {
			// 切断状態なのでなにもしない
			return Promise.resolve();
		}
		holder.removeEventHandler(handler);
		if (!holder.eventHandlers.length) {
			return holder
				.cancelConsumeEvent()
				.then(() => {
					// returns void
				})
				.catch((err) => {
					// 処理中の close によるエラーは無視する
					if (holder.state !== State.CLOSED) {
						return Promise.reject(err);
					}
				});
		} else {
			return Promise.resolve();
		}
	}

	public cancelConsumeEvent(playId: string): Promise<void> {
		const holder = this._amqpHolders[playId];
		if (!holder) {
			// 切断状態なのでなにもしない
			return Promise.resolve();
		}
		return holder
			.cancelConsumeEvent()
			.then(() => {
				// returns void
			})
			.catch((err) => {
				// 処理中の close によるエラーは無視する
				if (holder.state !== State.CLOSED) {
					return Promise.reject(err);
				}
			});
	}

	public publishEvent(playId: string, event: playlog.Event): void {
		const holder = this._amqpHolders[playId];
		if (!holder) {
			this._logger.warnWithAux("publishEvent failed, no amqp connection", { playId });
			return;
		}
		holder.publishEvent(event);
	}

	public publishTickRaw(playId: string, tick: Buffer): void {
		this._waitForLock(playId, () => {
			this._putTickToStore(playId, tick);
			const holder = this._amqpHolders[playId];
			if (!holder) {
				this._logger.warnWithAux("publishTickRaw failed, no amqp connection", { playId });
				return;
			}
			holder.publishTick(tick);
		});
	}

	public acquireWriteLock(playId: string, onReleased: () => void): Promise<void> {
		return this._writeLockClient.acquireLock(playId, writeLock.OWNER_TYPE_PLAYLOG_SERVER).then((lock) => {
			if (!lock) {
				return Promise.reject(new Error("Failed to acquire a write lock"));
			}
			lock.on("checked", () => {
				this._flushMessages(playId);
			});
			lock.on("released", () => {
				onReleased();
			});
			this._writeLocks[playId] = lock;
		});
	}

	public releaseWriteLock(playId: string): Promise<boolean> {
		return this._writeLockClient.releaseLock(playId);
	}

	private _waitForLock(playId: string, callback: () => void): void {
		const lock = this._writeLocks[playId];
		if (lock && lock.state === writeLock.WriteLockStatus.Locked) {
			callback();
		} else {
			const buffers = (this._publishBuffers[playId] = this._publishBuffers[playId] || []);
			buffers.push(callback);
		}
	}

	private _flushMessages(playId: string): void {
		const buffers = this._publishBuffers[playId];
		if (!buffers) {
			return;
		}

		let buf: () => void;
		// tslint:disable-next-line:no-conditional-assignment
		while ((buf = buffers.shift())) {
			buf();
		}
	}

	private _putTickToStore(playId: string, tick: Buffer): void {
		const t = amflowMessage.decodeTick(tick);
		this._playlogStore.putTick(playId, t); // TODO: 再エンコードされないように改善の余地あり
	}
}
