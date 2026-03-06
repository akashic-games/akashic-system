import * as activeRecord from "@akashic/akashic-active-record";
import * as restCommons from "@akashic/akashic-rest-commons";
import { AmqpConnection, AmqpConnectionManager } from "@akashic/amqp-utils";
import * as callback from "@akashic/callback-publisher";
import config from "config";
import * as http from "http";
import * as https from "https";
import * as log4js from "log4js";
import { Logger, Log4jsAppender, context } from "@akashic-system/logger";
import { AppConfig, RabbitMQConfig, Timeout } from "./configs";
import { connect, event } from "./core";
import { Bootstrap as MasterBootstrap } from "./master/Bootstrap";
import * as Router from "./Router";
import { CallbackPublisher } from "./util/CallbackPublisher";
import { LogFactory } from "./util/LogFactory";
import { RequestConsumer } from "./util/RequestConsumer";

let logConf: log4js.Configuration;
if (config.has("logger")) {
	// log4js 2.x 以降の configuration は config.logger で
	logConf = config.get<log4js.Configuration>("logger");
} else {
	// log4js 2.x より前の configuration (config.log で定義) しか存在しない場合の移行措置
	const oldConfig = config.get<any>("log");
	const levels = oldConfig.levels || {};
	const appender = {
		type: "console",
		layout: {
			type: "basic",
		},
	};
	logConf = {
		appenders: {
			out: appender,
			access: appender,
			error: appender,
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
const logFactory = new LogFactory();
const logger = logFactory.getLogger("out");

const appConfig = config.get<AppConfig>("appConfig");

const rabbitmqConfig = config.get<RabbitMQConfig>("rabbitmq");
const amqpConnectionManager = new AmqpConnectionManager({
	urls: rabbitmqConfig.url,
	user: rabbitmqConfig.user,
	password: rabbitmqConfig.passwd,
});
amqpConnectionManager.on("connect", (conn: AmqpConnection) => {
	logger.info("connected to amqp server: " + conn.url);
});
amqpConnectionManager.on("close", (conn: AmqpConnection) => {
	logger.warn("disconnected from amqp server: " + conn.url);
});
amqpConnectionManager.on("channelError", (err: Error) => {
	logger.warn("amqp channel error: " + err.message);
});
const callbackSender = new callback.Publisher(amqpConnectionManager);

const timeout = config.get<Timeout>("appConfig.process.timeout");

// zookeeper切断時に死亡するコードの追加
event.addListener("connectionDead", () => {
	logger.fatal("zookeeper connection dead");
	process.exit(1);
});

// shutdown ハンドラ用
let server: http.Server | https.Server | null = null; // bootstrap() 内で初期化
let masterController: import("./core").MasterController | null = null; // bootstrap() 内で初期化
let requestConsumer: RequestConsumer | null = null; // bootstrap() 内で初期化

async function finalize(exitCode: number): Promise<void> {
	setTimeout(() => {
		process.exit(1);
	}, 10000); // 終了処理が固まった時の保険
	if (masterController && masterController.isMaster) {
		if (requestConsumer) {
			logger.info("stopping request consumer");
			await requestConsumer.stop();
		}
		if (server) {
			logger.info("stopping server");
			server.close();
		}
		logger.info("stopping master activity");
		// master を降りる、sub-master がいればそちらに master が切り替わる
		await masterController.demoteMasterPost();
		// 処理中のタスクがあるかもしれないので、プロセス終了まで 5 秒待つ
		await new Promise((resolve, _reject) => setTimeout(resolve, 5000));
	}
	logger.info("exiting master process");
	process.exit(exitCode);
}

process.once("SIGTERM", async () => {
	await finalize(1);
});
process.once("SIGINT", async () => {
	await finalize(1);
});
process.once("uncaughtException", async (err: any) => {
	logger.fatal(`uncaught exception: ${err}`);
	await finalize(1);
});
process.on("unhandledRejection", (err: any) => {
	logger.warn(`unhandled promise rejection: ${err}`);
});

// 起動処理
async function serve(): Promise<void> {
	// connect zookeeper
	const zooSetting = config.get<import("./core").ZookeeperConfig>("zookeeper");
	const core = await connect(zooSetting);
	await core.masterController.initClusterNodes();
	masterController = core.masterController;

	// connect database
	const dbConfigLoader = new activeRecord.DatabaseConfigLoader(config);
	const database = await activeRecord.Database.createConnection(dbConfigLoader.load("dbSettings.database"));

	// connect RabbitMQ
	await amqpConnectionManager.init();
	// setup callback publisher
	await callbackSender.setup();
	const callbackPublisher = new CallbackPublisher(callbackSender, logFactory);

	// boot master
	const masterBootstrap = new MasterBootstrap(core, appConfig, database, callbackPublisher, logFactory, timeout);
	const bootResult = await masterBootstrap.boot(); // masterを起動させて各種準備終わらせる
	// master 昇格するまでここには到達しない

	// RabbitMQ からのインスタンスリクエスト受付開始
	requestConsumer = new RequestConsumer(amqpConnectionManager, bootResult.instanceManager, logFactory);
	await requestConsumer.start();

	// master受付サーバ(REST 版)を起動する
	const portOffset = Number(config.get<any>("server.portOffset"));
	const port = config.get<number>("server.port") + (isNaN(portOffset) ? 0 : portOffset);
	logger.info("server start at port: " + port);
	server = new restCommons.Server().start({
		listening: port,
		accessLogger: new Logger([new Log4jsAppender(log4js.getLogger("access"))]),
		router: Router.create(bootResult.instanceManager, core.masterController),
	});
}

serve().catch(async (err) => {
	logger.fatal("boot failed", context({ error: err }));
	await finalize(1);
});
