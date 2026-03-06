import { PlaylogStoreFacade, PlaylogDatabase, MongoDBStore, PlaylogMetadataMongoDBStore, PlaylogS3Store } from "@akashic/akashic-system";
import * as restCommons from "@akashic/akashic-rest-commons";
import lu = require("@akashic/log-util");
import playlog = require("@akashic/playlog");
import * as serverEngine from "@akashic/playlog-server-engine";
import amqp = require("amqplib");
import { S3Client } from "@aws-sdk/client-s3";
import config = require("config");
import events = require("events");
import express from "express";
import * as fs from "fs";
import http = require("http");
import * as https from "https";
import log4js = require("log4js");
import mongodb = require("mongodb");
import * as mysql from "mysql";
import { Logger, Log4jsAppender } from "@akashic-system/logger";
import { AMQPConnectionFactory } from "./AMQPConnectionFactory";
import { PlaylogHandler } from "./PlaylogHandler";
import { PlaylogServerControlEventConsumer } from "./PlaylogServerControlEventConsumer";
import { PlaylogServerControlHandler } from "./PlaylogServerControlHandler";
import { PlaylogSessionObserver } from "./PlaylogSessionObserver";
import * as writeLock from "./PlaylogWriteLock";
import { PlayTokenEventConsumer } from "./PlayTokenEventConsumer";
import { PlayTokenValidator, PlayTokenValidatorConfiguration } from "./PlayTokenValidator";
import { RequestHandler } from "./RequestHandler";
import { Router } from "./rest/Router";
import { ServerEngineFactory } from "./ServerEngineFactory";
import { SessionManager } from "./SessionManager";
import { SystemControlAPIHandler } from "./SystemControlAPIHandler";

import { AliveMonitoringRedis } from "@akashic/alive-monitoring-core";
import { DispatchingRedis } from "@akashic/dispatching-core";
import { EventLimitCount } from "./EventLimitCount";
import { Cluster as RedisCluster, default as Redis, RedisCommander } from "ioredis";

// このファイル内でグローバルに使用される変数
const logger = new lu.LogUtil(log4js.getLogger("out"));

// 以下、 export するクラスやインターフェースなどの宣言と、それに付随するもの
export interface DispatcherConfig {
	maxClients: number;
	processId: string;
	endpoint: string;
	trait: string;
	clusterName: string;
	reservationEndpoint: string; // Dispatcher がアクセスする URI
	reservationExpire: number;
	reservationPort: number; // Dispatcher からアクセスされるエンドポイントのサーバが Listen するポート
}

export interface Option {
	dispatcherConfig?: DispatcherConfig;
	port: number;
	keyPath?: string;
	certPath?: string;
}

export class Application extends events.EventEmitter {
	// TODO: fix limit
	private static _LOGS_LIMIT = Infinity;

	/**
	 * インターネット側からアクセスされる WebSocket サーバの土台
	 */
	private _httpPublicServer: http.Server | https.Server;
	/**
	 * クラスターネットワーク内のクラスタノードからアクセスされるHTTPサーバ
	 */
	private _httpServer: http.Server | https.Server;
	/**
	 * インターネット側からアクセスされる WebSocket サーバ
	 */
	private _engineServer: serverEngine.Server;
	private _factory: ServerEngineFactory;

	private _amqpConnectionFactory: AMQPConnectionFactory;

	private _mongoDbClient: mongodb.MongoClient;
	private _mysqlPool: mysql.Pool;
	private _playlogDatabase: PlaylogDatabase;

	private _stopped: boolean;

	private _requestHandler: RequestHandler;
	private _playlogHandler: PlaylogHandler;
	private _playlogServerControlHandler: PlaylogServerControlHandler;

	private redis: RedisCluster | Redis;

	private _systemControlAPIHandler: SystemControlAPIHandler;

	private _playlogStore: PlaylogStoreFacade | null;
	private _playTokenEventConsumer: PlayTokenEventConsumer;
	private _playlogServerControlEventConsumer: PlaylogServerControlEventConsumer;
	private _playTokenValidator: PlayTokenValidator;
	private _writeLockClient: writeLock.IClient;

	private _dataStoreHandler: { connect: () => Promise<void>; disconnect: () => Promise<void> };

	private _opts: Option;

	private _sessionManager: SessionManager;

	private _dispatchingRedis: DispatchingRedis;
	private _aliveMonitoring: AliveMonitoringRedis;

	private _sessionObserver: PlaylogSessionObserver;

	constructor(opts?: Option) {
		super();
		this._opts = opts || { port: config.get<number>("server.port") };
		this._httpPublicServer = null;
		this._httpServer = null;
		this._engineServer = null;
		this._amqpConnectionFactory = new AMQPConnectionFactory(
			{
				url: config.get<string>("rabbitmq.url"),
				user: config.get<string>("rabbitmq.user"),
				passwd: config.get<string>("rabbitmq.passwd"),
			},
			logger,
		);
		this._mongoDbClient = null;
		this._requestHandler = null;
		this._playlogHandler = null;
		this._systemControlAPIHandler = null;
		this._playlogServerControlHandler = null;
		this._stopped = false;

		this._playlogStore = null;
		this._playTokenEventConsumer = new PlayTokenEventConsumer(this._amqpConnectionFactory, logger);
		this._playlogServerControlEventConsumer = new PlaylogServerControlEventConsumer(this._amqpConnectionFactory, logger);
		this._playTokenValidator = new PlayTokenValidator(
			config.get<PlayTokenValidatorConfiguration>("tokenValidator"),
			this._playTokenEventConsumer,
		);
		this._writeLockClient = new writeLock.NoLockClient();

		this._dispatchingRedis = null;
		this._aliveMonitoring = null;

		this._sessionManager = null;

		const backend = config.get<string>("datastore.backend");
		switch (backend) {
			case "mongodb":
				this._dataStoreHandler = { connect: this._connectPlaylogStore.bind(this), disconnect: this._disconnectPlaylogStore.bind(this) };
				break;
			default:
				throw new Error("unknown datastore backend: " + backend);
		}
		const pool = mysql.createPool(config.get("mysql"));
		this._mysqlPool = pool;
		this._playlogDatabase = new PlaylogDatabase(pool);

		// 現状、Dispatcher と セッション監視は、セットになっている。
		// 逆に、Dispatcher がいないと、監視対象がない状態になる。
		// 接続先の Redis サーバを Application 側で切り替えることがるのかは謎いけれど、
		// 一応、設定項目を追加 ＆ ここの設定の項目名を変更 すれば、接続先を分けることができる感じにはしておく。
		this.redis = config.has("dispatchingRedis.hosts") // is cluster?
			? new RedisCluster(config.get("dispatchingRedis.hosts"), config.get("dispatchingRedis.option"))
			: new Redis(config.get("dispatchingRedis.port"), config.get("dispatchingRedis.host"), config.get("dispatchingRedis.option"));
	}

	public start(callback?: (err?: any) => void): Application {
		let tasks: Promise<void>[] = null;
		if (config.get<boolean>("disableClustering")) {
			tasks = [this._dataStoreHandler.connect(), this._playTokenEventConsumer.open(), this._playlogServerControlEventConsumer.open()];
		} else {
			tasks = [
				this._dataStoreHandler.connect(),
				this._connectAliveMonitoring(),
				this._playTokenEventConsumer.open(),
				this._playlogServerControlEventConsumer.open(),
			];
		}
		Promise.all(tasks)
			.then(() => {
				this._systemControlAPIHandler = new SystemControlAPIHandler(logger);
				this._requestHandler = new RequestHandler(this._playlogStore, logger);
				this._playlogHandler = new PlaylogHandler(
					this._amqpConnectionFactory,
					this._playlogStore,
					this._requestHandler.getTickCacheManager(),
					this._writeLockClient,
					config.get<number>("rabbitmq.prefetchCount"),
					config.get<number>("rabbitmq.prefetchInterval"),
					logger,
				);
				this._factory = new ServerEngineFactory(
					{
						playlog: this._playlogHandler,
						request: this._requestHandler,
						systemControlAPI: this._systemControlAPIHandler,
						playTokenValidator: this._playTokenValidator,
					},
					logger,
					config.get<EventLimitCount>("eventLimitCount"),
				);
				const reopenTimeout = config.has("server.reopenTimeout") ? config.get<number>("server.reopenTimeout") : 5 * 60 * 1000;
				this._playlogServerControlHandler = new PlaylogServerControlHandler(
					this._playlogServerControlEventConsumer,
					this._requestHandler.getTickCacheManager(),
				);
				if (this._opts.dispatcherConfig) {
					return this._startEngineWithDispatcher(reopenTimeout);
				} else {
					return this._startEngine(reopenTimeout);
				}
			})
			.then(
				() => {
					logger.info("app started");
					if (callback) {
						callback();
					}
				},
				(err: any) => {
					logger.warn("app failed to start: %s", err.stack || err.message || err);
					if (callback) {
						callback(err);
					}
				},
			);
		return this;
	}

	public stop(callback?: (err?: any) => void): Application {
		this._stopped = true;
		// TODO: closes all client first.
		const cleaner = this._playlogHandler ? this._playlogHandler.cleanup() : Promise.resolve();
		cleaner
			.then(() => {
				const close = [this._playTokenEventConsumer.close(), this._playlogServerControlEventConsumer.close()];
				return Promise.all(close);
			})
			.then(() => {
				let disconnect: Promise<void>[] = null;
				if (config.get<boolean>("disableClustering")) {
					disconnect = [this._close(), this._dataStoreHandler.disconnect(), this._disconnectDispatchRedis()];
				} else {
					disconnect = [
						this._close(),
						this._dataStoreHandler.disconnect(),
						this._disconnectAliveMonitoring(),
						this._disconnectDispatchRedis(),
					];
				}
				return Promise.all(disconnect);
			})
			.then(() => {
				this.redis.disconnect();
			})
			.then(
				() => {
					logger.info("app stopped");
					if (callback) {
						callback();
					}
				},
				(err: any) => {
					logger.warn("app failed to stop: %s", err.stack || err.message || err);
					if (callback) {
						callback(err);
					}
				},
			);
		return this;
	}

	private _handleSessionManager(): Promise<void> {
		const dpConf = this._opts.dispatcherConfig;
		this._sessionManager.attachServer(this._engineServer);
		this._sessionManager.on("end", (playId: string) => {
			// セッションが終了した
			return this._dispatchingRedis
				.increaseCapacity(dpConf.processId, dpConf.trait, 1)
				.then(() => this._dispatchingRedis.increaseClient(dpConf.processId, dpConf.trait, playId, -1));
		});
		this._sessionManager.on("timeout", (playId: string) => {
			// 予約がタイムアウトした
			logger.warn("the session for %s was timeout.", playId);
			return this._dispatchingRedis
				.increaseCapacity(dpConf.processId, dpConf.trait, 1)
				.then(() => this._dispatchingRedis.increaseClient(dpConf.processId, dpConf.trait, playId, -1));
		});
		this._sessionManager.on("limit", (playId: string) => {
			logger.warn("the session for %s was denied by limit.", playId);
		});
		this._sessionManager.on("deny", (playId: string) => {
			logger.warn("the non-reserved session for %s was denied.", playId);
		});
		return Promise.resolve();
	}

	private _startEngineWithDispatcher(reopenTimeout: number): Promise<void> {
		const c = this._opts.dispatcherConfig;

		const redis: RedisCommander = config.has("dispatchingRedis.hosts") // is cluster?
			? new RedisCluster(config.get("dispatchingRedis.hosts"), config.get("dispatchingRedis.option"))
			: new Redis(config.get("dispatchingRedis.port"), config.get("dispatchingRedis.host"), config.get("dispatchingRedis.option"));
		this._dispatchingRedis = new DispatchingRedis(redis);

		return this._dispatchingRedis
			.assignCapacity({ processId: c.processId, trait: c.trait, capacity: c.maxClients })
			.then(() => {
				// 各サーバの設定と、インスタンスの生成
				// 「UPGRADE用のHTTPサーバ」「UPGRADE後のWebSocketサーバ」「クラスタネットワーク用のHTTPサーバ」の3つを作る
				// 各サーバのイベントリスナ（EventEmitter）の登録は、全サーバインスタンスをエラーなく生成できたあとに行う。

				// _httpPublicServer
				const router = express.Router();
				router.get("/healthcheck", (req, res) => res.sendStatus(200));
				const publicServerOption: restCommons.ServerSettings = {
					listening: this._opts.port,
					accessLogger: new Logger([new Log4jsAppender(log4js.getLogger("access"))]),
					router,
				} as restCommons.ServerSettings;
				if ("keyPath" in this._opts && "certPath" in this._opts) {
					logger.info("found SSL/TLS configs.");
					try {
						// 「あとから読み込もうとした方でミスった場合に、片方だけ入る」のを阻止するため、一度変数に代入する。
						const key = fs.readFileSync(this._opts.keyPath, "utf8");
						const cert = fs.readFileSync(this._opts.certPath, "utf8");
						publicServerOption.key = key;
						publicServerOption.cert = cert;
						logger.info("over SSL/TLS");
					} catch (e) {
						logger.warn("fail to read SSL/TLS key or certification file");
					}
				}
				logger.info("start http public server on " + this._opts.port + " port.");
				this._httpPublicServer = new restCommons.Server().start(publicServerOption);

				// keepalive timeout周りの設定(ALB対策)
				if (config.has("server.keepAliveTimeout")) {
					this._httpPublicServer.keepAliveTimeout = config.get<number>("server.keepAliveTimeout");
				}
				if (config.has("server.headersTimeout")) {
					this._httpPublicServer.headersTimeout = config.get<number>("server.headersTimeout");
				}

				// _engineServer
				// Web Socket のサーバ
				this._engineServer = new serverEngine.WebSocketServer(this._factory, logger, {
					server: this._httpPublicServer,
					sessionRefuseClient: true,
					socketOption: { reopenTimeout },
				});

				// _httpServer
				// クラスタネットワーク用のHTTPサーバ
				// セッションを管理するのは、 Dispatcher を使っている場合のみ
				this._sessionManager = new SessionManager(c.maxClients, c.reservationExpire || 10 * 1000, this._playTokenValidator, logger);
				// セッションを管理するのは、 Dispatcher を使っている場合のみ
				// this._sessionManager を使っている。本来であれは、引数で渡すべき。
				return this._attachSessionObserver();
			})
			.then(() => {
				const serverOption: restCommons.ServerSettings = {
					listening: c.reservationPort,
					accessLogger: new Logger([new Log4jsAppender(log4js.getLogger("access"))]),
					router: Router.create(this._sessionManager),
				} as restCommons.ServerSettings;
				logger.info("start http server on " + c.reservationPort + " port.");
				this._httpServer = new restCommons.Server().start(serverOption);

				// ALB向けkeepalive設定
				if (config.has("reservationServer.keepAliveTimeout")) {
					this._httpServer.keepAliveTimeout = config.get<number>("reservationServer.keepAliveTimeout");
				}
				if (config.has("reservationServer.headersTimeout")) {
					this._httpServer.headersTimeout = config.get<number>("reservationServer.headersTimeout");
				}

				// 各サーバの EventEmitter のバインド
				this._httpPublicServer.on("error", this._onError.bind(this));
				this._engineServer.on("error", this._onError.bind(this));
				this._httpServer.on("error", this._onError.bind(this));

				return this._handleSessionManager();
			});
	}

	/**
	 *
	 * @private
	 */
	private _attachSessionObserver(): Promise<void> {
		// Observer の初期化
		const c = this._opts.dispatcherConfig;

		this._sessionObserver = new PlaylogSessionObserver(c.processId, this.redis);

		// 各 イベントに対する、 Observer の notify 先を定義
		this._sessionManager.on("reserve", () => {
			return this._sessionObserver.onReserve();
		});
		this._sessionManager.on("start", () => {
			return this._sessionObserver.onStart();
		});
		this._sessionManager.on("timeout", () => {
			return this._sessionObserver.onRevoke();
		});
		this._sessionManager.on("end", () => {
			return this._sessionObserver.onEnd();
		});

		return this._sessionObserver.init();
	}

	private _startEngine(reopenTimeout: number): Promise<void> {
		this._engineServer = new serverEngine.WebSocketServer(this._factory, logger, { socketOption: { reopenTimeout } });
		this._engineServer.on("error", this._onError.bind(this));
		return new Promise<void>((resolve, reject) => {
			this._engineServer.listen(this._opts.port, (err: any) => {
				if (err) {
					return reject(err);
				}
				resolve();
			});
		});
	}

	private async _connectPlaylogStore(): Promise<void> {
		const client = await mongodb.MongoClient.connect(config.get<string>("datastore.mongodb.url"));
		this._mongoDbClient = client;
		const dbName = config.get<string>("datastore.mongodb.database");
		const db = client.db(dbName);
		const { accessKeyId, secretAccessKey, ...rest } = config.get<{ accessKeyId?: string; secretAccessKey?: string; endpoint?: string }>(
			"s3",
		);
		const s3 = new S3Client({
			credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
			region: "ap-northeast-1",
			...rest,
		});
		const activeStore = new MongoDBStore(db);
		const metadataStore = new PlaylogMetadataMongoDBStore(db);
		const archiveStore = new PlaylogS3Store(s3, config.get("archiveSettings"));

		this._playlogStore = new PlaylogStoreFacade({
			activeStore,
			archiveStore,
			metadataStore,
			lock: this._playlogDatabase,
		});
	}

	private async _disconnectPlaylogStore(): Promise<void> {
		await this._mongoDbClient.close(true);
		this._mongoDbClient = null;
		this._playlogStore = null;
		return new Promise<void>((resolve, reject) => {
			this._mysqlPool.end((err) => {
				if (err) {
					return reject(err);
				}
				resolve();
			});
		});
	}

	private async _connectAliveMonitoring(): Promise<void> {
		if (this._opts.dispatcherConfig) {
			this._aliveMonitoring = new AliveMonitoringRedis(this.redis);
			await this._aliveMonitoring.joinProcess({
				id: this._opts.dispatcherConfig.processId,
				trait: this._opts.dispatcherConfig.trait,
				endpoint: this._opts.dispatcherConfig.endpoint,
				numMaxClients: this._opts.dispatcherConfig.maxClients,
				reservationEndpoint: this._opts.dispatcherConfig.reservationEndpoint,
			});
		}
	}

	private _close(): Promise<void> {
		const httpTerminator = (resolve: any) => {
			if (this._httpPublicServer) {
				// http.Server は、 close() に callback を渡せるが、 https の場合に渡せない。
				this._httpPublicServer.close();
				setImmediate(() => {
					resolve();
				});
			} else {
				resolve();
			}
		};
		return new Promise<void>((resolve) => {
			if (this._engineServer) {
				this._engineServer.close((err: any) => {
					httpTerminator(resolve);
				});
			} else {
				httpTerminator(resolve);
			}
		});
	}

	private async _disconnectAliveMonitoring(): Promise<void> {
		if (this._opts.dispatcherConfig) {
			await this._aliveMonitoring.leaveProcess({
				id: this._opts.dispatcherConfig.processId,
				trait: this._opts.dispatcherConfig.trait,
				endpoint: this._opts.dispatcherConfig.endpoint,
				numMaxClients: this._opts.dispatcherConfig.maxClients,
				reservationEndpoint: this._opts.dispatcherConfig.reservationEndpoint,
			});
		}
	}

	private _disconnectDispatchRedis(): Promise<void> {
		const dpConf = this._opts.dispatcherConfig;
		if (dpConf) {
			return this._dispatchingRedis.unassignCapacity({ processId: dpConf.processId, trait: dpConf.trait, capacity: dpConf.maxClients });
		} else {
			return Promise.resolve();
		}
	}

	private _onError(err: any): void {
		logger.warn("Application error: %s", err.stack || err.message || err);
		this.emit("error", err);
	}

	/**
	 * @event Application#connection
	 * @type {client.Client} client
	 */

	/**
	 * @event Application#error
	 * @type {Error} err
	 */
}
