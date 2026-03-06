import * as restCommons from "@akashic/akashic-rest-commons";
import { Logger, Log4jsAppender, ILogger } from "@akashic-system/logger";
import { IncomingWebhook } from "@slack/webhook";
import cluster from "cluster";
import config from "config";
import * as fs from "fs";
import * as http from "http";
import * as https from "https";
import * as log4js from "log4js";
import { hostname } from "os";
import SystemControlClient from "./clients/SystemControlClient";
import Router from "./server/Router";
import { Cluster as RedisCluster, default as Redis, RedisCommander } from "ioredis";
import { DynamicDispatcher } from "./services/DynamicDispatcher";
import { detectResponseTimeoutMiddleware } from "./server/detectResponseTimeoutMiddleware";

//
import { AliveMonitoringRedis } from "@akashic/alive-monitoring-core";
import { DispatchingRedis } from "@akashic/dispatching-core";
import { Dispatcher } from "@akashic/dispatcher";

function makeLogger(): ILogger {
	let logConf: log4js.Configuration;
	if (config.has("logger")) {
		// log4js 2.x 以降の configuration は config.logger で
		logConf = config.get<log4js.Configuration>("logger");
	} else {
		// log4js 2.x より前の configuration (config.log で定義) しか存在しない場合の移行措置
		const oldConfig = config.get<any>("log");
		const levels = oldConfig.levels || {};
		const consoleAppender = {
			type: "console",
			layout: {
				type: "basic",
			},
		};
		logConf = {
			appenders: {
				out: consoleAppender,
				access: consoleAppender,
				error: consoleAppender,
			},
			categories: {
				default: {
					appenders: ["out"],
					level: levels.out || "trace",
				},
				out: {
					appenders: ["out"],
					level: levels.out || "trace",
				},
				access: {
					appenders: ["access"],
					level: levels.access || "trace",
				},
				error: {
					appenders: ["error"],
					level: levels.error || "trace",
				},
			},
		};
	}
	log4js.configure(logConf);
	return new Logger([new Log4jsAppender(log4js.getLogger("out"))]);
}

function bootApiServer(logger: ILogger): void {
	// Router を作る

	// Router の 1、dispatcher
	// 1.1
	const trait: any = config.get("dispatching.dynamic.playlogServer.trait");
	// 1.2.1
	const redis: RedisCommander = config.has("dispatching.dynamic.redis.hosts") // is cluster?
		? new RedisCluster(config.get("dispatching.dynamic.redis.hosts"), config.get("dispatching.dynamic.redis.option"))
		: new Redis(
				config.get("dispatching.dynamic.redis.port"),
				config.get("dispatching.dynamic.redis.host"),
				config.get("dispatching.dynamic.redis.option"),
			);
	const dispatching: any = new DispatchingRedis(redis);
	// 1.2.2
	const aliveMonitoringRedis = new AliveMonitoringRedis(redis);
	// 1.2.3
	const monitorCacheExpireMsec: number = config.get("dispatching.dynamic.server.monitorCacheExpireMsec");
	const shuffleProcessCount: number = config.get("dispatching.dynamic.server.shuffleProcessCount");
	// dispatcher 作る
	const dispatcher = new Dispatcher(dispatching, aliveMonitoringRedis, monitorCacheExpireMsec, shuffleProcessCount);
	dispatcher.logger = logger;
	const dynamicDispatcher = new DynamicDispatcher(trait, dispatcher);
	dynamicDispatcher.logger = logger;

	// Router の 2
	const clients: SystemControlClient = new SystemControlClient(logger);

	// Router の post construct で使うやつ
	const portOffset: number = Number(config.get<any>("server.portOffset"));
	const port: number = config.get<number>("server.port") + (isNaN(portOffset) ? 0 : portOffset);
	const unixDomainSocket: string = config.get<string>("server.unixDomainSocket");
	const listening: any = unixDomainSocket || port;
	const pidFilePath: string = config.get<string>("server.pidFile");

	if (unixDomainSocket) {
		try {
			fs.unlinkSync(unixDomainSocket);
		} catch (e) {
			// do nothing
		}
	}

	// router の 3
	const bodySizeLimit: string = config.get<string>("server.bodySizeLimit");

	// Router の post construct で使うやつ
	const server: restCommons.Server = new restCommons.Server();

	logger.info(`server initialized. pid:${process.pid}`);

	Router(dynamicDispatcher, clients, bodySizeLimit)
		.then((router) => {
			const logHandler = log4js.connectLogger(log4js.getLogger("access"), {
				format:
					':remote-addr - - ":method :url HTTP/:http-version" :status :content-length' + ' ":referrer" ":user-agent" :response-time msec',
				level: "auto",
			});
			const httpServer: http.Server | https.Server = server.start({
				listening,
				logHandler,
				router,
				middlewares: [detectResponseTimeoutMiddleware(logger)],
			});
			if (config.has("server.timeout")) {
				httpServer.timeout = config.get<number>("server.timeout");
			}
			if (typeof httpServer.keepAliveTimeout === "number") {
				// keepAliveTimeout は node v8.0.0 以降からサポート
				// config に keepAliveTimeout の設定がない場合は 0 に設定して node6 の挙動に合わせる
				// https://nodejs.org/docs/latest-v8.x/api/http.html#http_server_keepalivetimeout
				const keepAliveTimeout: number = config.has("server.keepAliveTimeout") ? config.get<number>("server.keepAliveTimeout") : 0;
				httpServer.keepAliveTimeout = keepAliveTimeout;
			}
			// ALB向けkeepalive設定
			if (config.has("server.headersTimeout")) {
				httpServer.headersTimeout = config.get<number>("server.headersTimeout");
			}

			logger.info(`server start at:${listening}, pid:${process.pid}`);
			if (pidFilePath) {
				httpServer.on("listening", () => {
					try {
						fs.writeFileSync(pidFilePath, String(process.pid));
					} catch (e) {
						logger.warn(e as any);
					}
				});
			}
		})
		.catch((err) => {
			logger.error(`failed to start server, pid:${process.pid}, err:${err}`);
			process.exit(1);
		});
}

// got signals
const slackNotifier: IncomingWebhook = new IncomingWebhook(config.get<string>("slackNotifier.url"));
process.once("SIGINT", async (signal) => {
	await slackNotifier.send(`got SIGINT on ${hostname()}; signal: ${signal}`);
	process.exit(1);
});
process.once("SIGTERM", async (signal) => {
	await slackNotifier.send(`got SIGTERM on ${hostname()}; signal: ${signal}`);
	process.exit(1);
});
process.once("SIGSEGV", async (signal) => {
	await slackNotifier.send(`got SIGSEGV on ${hostname()}; signal: ${signal}`);
	process.exit(1);
});

// main
// ログ設定はプロセス間で同一(fork 時に dup されるはず)
const logger = makeLogger();
const defaultNumberOfWorkers = 1;
const numberOfWorkers = (config.has("server.numberOfWorkers") && config.get<number>("server.numberOfWorkers")) || defaultNumberOfWorkers;

if (numberOfWorkers > 1 && cluster.isMaster) {
	logger.info(`Making workers: ${numberOfWorkers}.`);
	for (let i = 0; i < numberOfWorkers; ++i) {
		cluster.fork();
	}
	cluster.on("exit", (worker, code, signal) => {
		logger.info(`worker died. pid:${worker.process.pid} code:${code}, signal:${signal}`);
	});
} else {
	bootApiServer(logger);
}
