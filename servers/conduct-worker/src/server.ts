import { Database, DatabaseConfigLoader } from "@akashic/akashic-active-record";
import config from "config";
import * as log4js from "log4js";
import { TickExporter } from "./callback/TickExporter";
import { InstanceConsumer } from "./event/instanceEvent/InstanceConsumer";
import { InstanceNotification } from "./event/instanceEvent/InstanceNotification";
import { AmqpConsumer, AmqpConsumerConfig } from "./util/AmqpConsumer";
import { LogFactory } from "./util/LogFactory";

const logConf = config.get<log4js.Configuration>("log");
log4js.configure(logConf);

const rabbitmqConf = config.get<AmqpConsumerConfig>("rabbitmq");
// tick export を有効にする場合、tickExporter.forward で tick forward 先の akashic system API base を指定する
const tickExporterConf = config.has("tickExporter") ? config.get<{ forward: string }>("tickExporter") : null;

const dbConfigLoader = new DatabaseConfigLoader(config);
const databaseConf = dbConfigLoader.load("dbSettings.database");

const logFactory = new LogFactory();
const logger = logFactory.getLogger("out");

const terminationHandlers = new Array<() => Promise<any>>();
process.once("SIGINT", terminationHandler.bind(undefined, terminationHandlers));
process.once("SIGTERM", terminationHandler.bind(undefined, terminationHandlers));
process.once("uncaughtException", async (err: any) => {
	logger.fatal(`uncaught exception: ${err}`);
	terminationHandler(terminationHandlers);
});
process.on("unhandledRejection", (err: any) => {
	logger.warn(`unhandled promise rejection: ${err}`);
});

const amqpConsumer = new AmqpConsumer(rabbitmqConf);
amqpConsumer.logger = logger;
terminationHandlers.push(amqpConsumer.close.bind(amqpConsumer));
let tickExporter: TickExporter = null;
if (tickExporterConf && tickExporterConf.forward) {
	tickExporter = new TickExporter(tickExporterConf.forward);
}

Database.createConnection(databaseConf)
	.then((database) => {
		const notification = new InstanceNotification(database);
		notification.logger = logger;
		InstanceConsumer.consume(amqpConsumer, notification, tickExporter, logger);
		return amqpConsumer.open();
	})
	.catch((error: any) => {
		// 異常発生時はリトライを試みずに終了する。本プロセスの冗長化で解決される。
		logger.fatal(`consume error: ${error}`);
		process.exit(1);
	});

function terminationHandler(handlers: (() => Promise<any>)[]) {
	Promise.all(handlers.map((c) => c()))
		.then(() => {
			logger.info("consumer of RabbitMQ finished");
			// 終了しなかったときのための保険
			setTimeout(() => {
				process.exit(1);
			}, 5000);
		})
		.catch((error: any) => {
			logger.fatal(`consume error: ${error}`);
			process.exit(1);
		});
}
