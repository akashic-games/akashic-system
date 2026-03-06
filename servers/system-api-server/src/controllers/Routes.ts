import * as activeRecord from "@akashic/akashic-active-record";
import * as restCommons from "@akashic/akashic-rest-commons";
import { AmqpChannelHolder, AmqpConnection, AmqpConnectionManager } from "@akashic/amqp-utils";
import { InstanceRequestPublisher } from "@akashic/instance-requester";
import * as dt from "@akashic/server-engine-data-types";
import * as Mysql from "mysql";

//
import { default as Redis, Cluster as RedisCluster, RedisCommander } from "ioredis";

//
import { Database } from "@akashic/akashic-active-record";
import { ConnectionFactory } from "@akashic/akashic-active-record/lib/connections/ConnectionFactory";
import { AMQPPlaylogPublisher, PlaylogDatabase, PlaylogFixture, PlayRelationModel } from "@akashic/akashic-system";
import config from "config";
/// clients
import SystemControlClient from "../clients/SystemControlClient";
// 他のレイヤ
/// config
import { RabbitMQConfig } from "../configs/RabbitMqConfig";
import InstanceServerService from "../domain/services/InstanceServerService";
/// domain/services/*ServerService
import PermissionServerService from "../domain/services/PermissionServerService";
import PlaylogApiServerService from "../domain/services/PlaylogApiServerService";
import ContentStorageService from "../domain/services/ContentStorageService";
import * as PlaylogStore from "../domain/services/PlaylogStore";
import * as PlaylogStoreConnection from "../domain/services/PlaylogStoreConnection";
import PlayServerService from "../domain/services/PlayServerService";
import { PlayTokenService } from "../domain/services/PlayTokenService";
/// domain/services
import { TokenGenerateService } from "../domain/services/TokenGenerateService";
/// services
import { DispatcherBase } from "../services/DispatcherBase";
import * as ElasticSearchConfig from "../utils/ElasticSearchConfig";
import { InstanceManager } from "../utils/InstanceManager";
/// utils
import { PlayManager } from "../utils/PlayManager";
// Controller
import InstanceController from "./instances/InstanceController";
import InstancesController from "./instances/InstancesController";
import PlayChildrenController from "./plays/childrens/PlayChildrenController";
import PlayChildrensController from "./plays/childrens/PlayChildrensController";
import PlaylogEventsController from "./plays/events/PlaylogEventsController";
import InstancesByPlayController from "./plays/instances/InstancesByPlayController";
import PlayPermitController from "./plays/permit/PlayPermitController";
import PlayController from "./plays/PlayController";
import PlaylogController from "./plays/playlog/PlaylogController";
import PlaysController from "./plays/PlaysController";
import StartPointsController from "./plays/startpoints/StartPointsController";
import PlaylogTicksController from "./plays/ticks/PlaylogTicksController";
import PlayTokenPurgeController from "./plays/tokens/purge/PlayTokenPurgeController";
import { TokensController } from "./plays/tokens/TokensController";
import { ReportsController } from "./reports/ReportsController";
import ContentStorageController from "./storages/ContentStorageController";

// main
export default async function create(
	dispatcher: DispatcherBase,
	client: SystemControlClient,
): Promise<{ [key: string]: restCommons.Controller }> {
	// 各種ミドルウェアへのコネクションの作成
	// redis
	// この関数は bootstrap の一部であって、1起動につき1回しか呼ばれない（リクエストごとで実行されない）ので、
	// ここで必要なサービスのインスタンスを作って渡しても問題ない
	const redisClient: RedisCommander = config.has("dispatching.dynamic.redis.hosts") // is cluster?
		? new RedisCluster(config.get("dispatching.dynamic.redis.hosts"), config.get("dispatching.dynamic.redis.option"))
		: new Redis(
				config.get("dispatching.dynamic.redis.port"),
				config.get("dispatching.dynamic.redis.host"),
				config.get("dispatching.dynamic.redis.option"),
			);
	// コンテンツストレージ用のredis
	const contentStorageRedisClient: RedisCommander = config.has("contentStorage.redis.hosts") // is cluster?
		? new RedisCluster(config.get("contentStorage.redis.hosts"), config.get("contentStorage.redis.option"))
		: new Redis(
				config.get("contentStorage.redis.port"),
				config.get("contentStorage.redis.host"),
				config.get("contentStorage.redis.option"),
			);
	// RabbitMQ
	// permission server だと bootstrap に書かれていたのだけれど、redis への Connection もこの関数内でやってしまっているし、
	// いったんここでやってしまう。
	const rabbitMqConfig = config.get<RabbitMQConfig>("rabbitmq");
	const amqpConnectionManager = new AmqpConnectionManager({
		urls: rabbitMqConfig.url,
		user: rabbitMqConfig.user,
		password: rabbitMqConfig.passwd,
	});
	amqpConnectionManager.on("connect", (conn: AmqpConnection) => {
		client.logger.info("connected to amqp server: " + conn.url);
	});
	amqpConnectionManager.on("close", (conn: AmqpConnection) => {
		client.logger.warn("disconnected from amqp server: " + conn.url);
	});
	amqpConnectionManager.on("channelError", (err: Error) => {
		client.logger.warn("amqp channel error: " + err.message);
	});
	await amqpConnectionManager.init();
	const channelHolder = new AmqpChannelHolder(amqpConnectionManager);
	// RDBMS (MySQL)
	const databaseConfig = config.get<activeRecord.DatabaseConfig>("dbSettings.database");
	const connectionFactory = new ConnectionFactory(databaseConfig, databaseConfig.pool);
	const database = new Database(connectionFactory);
	const mysqlPool = Mysql.createPool({
		host: databaseConfig.hosts[0].host,
		port: databaseConfig.hosts[0].port,
		user: databaseConfig.user,
		password: databaseConfig.password,
		database: databaseConfig.database,
		supportBigNumbers: true,
		bigNumberStrings: true,
		charset: "utf8mb4",
		stringifyObjects: true,
	});
	// PlaylogStore
	const playlogStoreConnection = new PlaylogStoreConnection.PlaylogStoreConnection(
		{
			playlogStore: config.get<PlaylogStoreConnection.PlaylogStoreConfig>("datastore"),
			s3: config.get("s3"),
			archiveSettings: config.get("archiveSettings"),
		},
		mysqlPool,
	);
	await playlogStoreConnection.connect();
	const playlogStore = new PlaylogStore.PlaylogStore(playlogStoreConnection);

	// @akashic/akashic-system
	const pool: any = await connectionFactory.getPool();
	// akashic-active-record の 型定義が間違っている。
	const playRelationModel = PlayRelationModel.create(redisClient, pool.origin as Mysql.Pool);

	// 設定ファイルから設定値を取ってくるもの
	const securityConfig = config.get<dt.SecurityConfig>("security");

	// もともと別のサーバが立っていたが、system-api-server に実装が移されてきたもの
	const playlogEventService = new PlaylogApiServerService(amqpConnectionManager, playlogStore);
	const permissionServerService = new PermissionServerService(
		new TokenGenerateService(securityConfig),
		new PlayTokenService(redisClient, securityConfig),
		amqpConnectionManager,
	);

	// PlaylogFixtureの作成
	const playlogPublisher = new AMQPPlaylogPublisher(channelHolder);
	const playlogDatabase = new PlaylogDatabase(mysqlPool);
	const playlogFixture = new PlaylogFixture(playlogPublisher, playlogDatabase);
	const playManager = new PlayManager(database, playlogFixture, playlogEventService, redisClient);
	playManager.logger = client.logger;
	const playServerService = new PlayServerService(playManager);

	const requestPublisher = new InstanceRequestPublisher(amqpConnectionManager);
	await requestPublisher.setup();
	const instanceManager = new InstanceManager(database, requestPublisher);
	const instanceServerService = new InstanceServerService(
		database,
		instanceManager,
		config.get<ElasticSearchConfig.ElasticSearchConfig>("apiConfigs.elasticsearch"),
	);

	const contentStorageService = new ContentStorageService(contentStorageRedisClient);

	// routing設定
	const routes: { [key: string]: restCommons.Controller } = {
		"/v1.0/plays": new PlaysController(playServerService),
		"/v1.0/plays/:playId": new PlayController(playServerService),
		"/v1.0/plays/:playId/tokens": new TokensController(dispatcher, permissionServerService, playServerService),
		"/v1.0/plays/:playId/tokens/purge": new PlayTokenPurgeController(permissionServerService, playServerService),
		"/v1.0/plays/:playId/instances": new InstancesByPlayController(instanceServerService),
		"/v1.0/plays/:playId/events": new PlaylogEventsController(playlogEventService),
		"/v1.0/plays/:playId/playlog": new PlaylogController(playlogEventService),
		"/v1.0/instances": new InstancesController(instanceServerService),
		"/v1.0/instances/:instanceId": new InstanceController(instanceServerService),
		"/v1.0/reports": new ReportsController(instanceServerService),
		"/v1.0/plays/:playId/children": new PlayChildrensController(playRelationModel),
		"/v1.0/plays/:playId/children/:childId": new PlayChildrenController(playRelationModel),
		"/v1.0/plays/:playId/startpoints": new StartPointsController(playlogEventService),
		"/v1.0/plays/:playId/ticks": new PlaylogTicksController(playlogEventService),
		"/v1.0/plays/permit": new PlayPermitController(permissionServerService),
		"/v1.0/storages/content": new ContentStorageController(contentStorageService),
	};
	return routes;
}
