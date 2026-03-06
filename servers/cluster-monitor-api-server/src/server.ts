import { Database, DatabaseConfig, DatabaseConfigLoader } from "@akashic/akashic-active-record";
import restCommons = require("@akashic/akashic-rest-commons");
import { AliveMonitoringRedis, ZookeeperRepository, ZookeeperDataSource } from "@akashic/alive-monitoring-core";
import { Log4jsAppender, Logger } from "@akashic-system/logger";
import config = require("config");
import fs = require("fs");
import log4js = require("log4js");
import Router = require("./server/Router");

//
import { default as Redis, Cluster as RedisCluster, RedisCommander } from "ioredis";

const logConf = config.get<log4js.Configuration>("logger");
log4js.configure(logConf);
const logger = new Logger([new Log4jsAppender(log4js.getLogger("out"))]);
const dbConfigLoader = new DatabaseConfigLoader(config);
const dbConf: DatabaseConfig = dbConfigLoader.load("dbSettings.database");
const unixDomainSocket = config.get<string>("server.unixDomainSocket");

const redisRepository: RedisCommander = config.has("dispatchingRedis.hosts") // is cluster?
	? new RedisCluster(config.get("dispatchingRedis.hosts"), config.get("dispatchingRedis.option"))
	: new Redis(config.get("dispatchingRedis.port"), config.get("dispatchingRedis.host"), config.get("dispatchingRedis.option"));

if (unixDomainSocket) {
	try {
		fs.unlinkSync(unixDomainSocket);
	} catch (e) {
		// do nothing
	}
}

const bodySizeLimit = config.get<string>("server.bodySizeLimit");
const zkConfig = config.get<ZookeeperDataSource>("zookeeper");
const zkRepository = new ZookeeperRepository(zkConfig);
const aliveMonitoringRedis = new AliveMonitoringRedis(redisRepository);

Database.createConnection(dbConf).then((database: Database) => {
	const portOffset = Number(config.get<any>("server.portOffset"));
	const port = config.get<number>("server.port") + (isNaN(portOffset) ? 0 : portOffset);
	const listening: any = unixDomainSocket || port;
	const server = new restCommons.Server();

	logger.info("server start at :" + listening);
	const httpServer = server.start({
		listening,
		accessLogger: new Logger([new Log4jsAppender(log4js.getLogger("access"))]),
		router: Router(database, aliveMonitoringRedis, zkRepository, bodySizeLimit, redisRepository),
	});

	const pidFilePath: string = config.get<string>("server.pidFile");
	if (pidFilePath) {
		httpServer.on("listening", () => {
			try {
				fs.writeFileSync(pidFilePath, String(global.process.pid));
			} catch (e) {
				logger.warn(e as any);
			}
		});
	}
});
