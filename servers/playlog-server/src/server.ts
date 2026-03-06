import { Option } from "./Application";
import { program } from "commander";

const fs = require("fs");
const config = require("config");
const log4js = require("log4js");
const url = require("url");
const playlogServer = require("../lib");
const lu = require("@akashic/log-util");
const version = require("../package.json").version;
const path = require("path");

// 引数の定義
program
	.version(version)
	.option("-d, --enableDispatcherSupport", "enable dispatcher support")
	.option("-m, --maxClients <n>", "num of max clients")
	.option("-i, --processId [value]", "process id")
	.option("-e, --endpoint [value]", "endpoint for service")
	.option("-p, --port [value]", "port")
	.option("-t, --trait [value]", "trait")
	.option("-c, --clusterName [value]", "cluster name")
	.option("-s, --reservationEndpoint [value]", "endpoint for client reservation")
	.option("--reservationPort [value]", "port number for client reservation")
	.option("-r, --reservationExpire [value]", "time for reservation expire")
	.option("--key [value] ", "SSL/TLS key file")
	.option("--cert [value]", "SSL/TLS certification file")
	.parse(process.argv);

// 設定ファイルと起動時の引数から、各種オプションを確定
// 優先度  起動時の引数 > 設定ファイル
const option: Option = {
	port: config.server.port,
	keyPath: config.server.keyPath,
	certPath: config.server.certPath,
};
const {
	port,
	key,
	cert,
	enableDispatcherSupport,
	maxClients,
	processId,
	endpoint,
	trait,
	clusterName,
	reservationEndpoint,
	reservationPort,
	reservationExpire,
} = program.opts();
if (port) {
	option.port = port;
}
if (key && cert) {
	option.keyPath = key;
	option.certPath = cert;
}

// Dispatcher を使用する場合の設定
if (enableDispatcherSupport) {
	if (!reservationEndpoint || !reservationPort) {
		throw Error("--reservationEndpoint and --reservationPort options are required when enableDispatcherSupport is used.");
	}
	option.dispatcherConfig = {
		maxClients: Number(maxClients),
		processId,
		endpoint,
		trait,
		clusterName,
		reservationExpire,
		reservationEndpoint,
		reservationPort,
	};
}

// Logger の設定
log4js.configure(config.get("log"));
const logger = new lu.LogUtil(log4js.getLogger("out"));

// Application の起動
logger.infoStart("boot", "playlog-server dispatcherOption %j", option.dispatcherConfig);

const app = new playlogServer.Application(option);

// Graceful shutdown:
process.once("SIGTERM", function (sig) {
	shutdown(app);
});
process.once("SIGINT", function (sig) {
	shutdown(app);
});

app.start(function (err) {
	if (err) {
		logger.fatalAbort("boot", "error:", err);
		process.exit(1);
	}
	logger.infoStart("boot", "playlog-server started %s", option.port);
});

function shutdown(app) {
	app.stop(function (err) {
		logger.infoEnd("boot", "playlog-server ended: %s:", err || "normal");
	});
	// graceful shutdown timer
	setTimeout(function () {
		process.exit();
	}, 5000);
}

process.on("unhandledRejection", function (err: Error) {
	logger.warn("unhandled promise rejection: ", err.stack || err.message || err);
});
