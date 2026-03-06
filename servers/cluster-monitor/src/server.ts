import { HostInfoClient, PlaylogServerHostInfoClient, PlaylogServerInfoClient, ProcessClient } from "@akashic/cluster-monitor-api-client";
import { DispatchingRedis } from "@akashic/dispatching-core";
import { SystemApiClient } from "@akashic/system-api-client";
import { InstanceClient, PlayClient } from "@akashic/system-control-api-client";
import config from "config";
import express from "express";
import * as log4js from "log4js";
import moment from "moment-timezone";
import * as ConfigInterface from "./configs/ApiConfig";
import * as Router from "./server/Router";

// external packages
import { default as Redis, Cluster as RedisCluster, RedisCommander } from "ioredis";

const bodyParser = require("body-parser");

const exphbs = require("express-handlebars");

const admin = config.get<boolean>("admin");
const logConf = config.get<log4js.Configuration>("log");
log4js.configure(logConf);
const apiConfigs = config.get<ConfigInterface.ApiConfigs>("apiConfigs");
const systemApiClient = new SystemApiClient(apiConfigs.systemAPI.baseUrl);
const instanceClient = new InstanceClient(apiConfigs.systemAPI.baseUrl);
const playClient = new PlayClient(apiConfigs.systemAPI.baseUrl);
const processClient = new ProcessClient(apiConfigs.clusterMonitorAPI.baseUrl);
const hostInfoClient = new HostInfoClient(apiConfigs.clusterMonitorAPI.baseUrl);
const playlogServerHostInfoClient = new PlaylogServerHostInfoClient(apiConfigs.clusterMonitorAPI.baseUrl);
const playlogServerInfoClient = new PlaylogServerInfoClient(apiConfigs.clusterMonitorAPI.baseUrl);

const portOffset = Number(config.get<any>("server.portOffset"));
const port = config.get<number>("server.port") + (isNaN(portOffset) ? 0 : portOffset);
const publicPath = "./public";
log4js.getLogger("out").info("server start at port: " + port);

const redis: RedisCommander = config.has("dispatchingRedis.hosts") // is cluster?
	? new RedisCluster(config.get("dispatchingRedis.hosts"), config.get("dispatchingRedis.option"))
	: new Redis(config.get("dispatchingRedis.port"), config.get("dispatchingRedis.host"), config.get("dispatchingRedis.option"));
const dispatchRedis: DispatchingRedis = new DispatchingRedis(redis);

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
const handler = log4js.connectLogger(log4js.getLogger("access"), { level: "auto" });

app.engine(
	"handlebars",
	exphbs({
		defaultLayout: "main",
		helpers: {
			rawDate: (date: Date) => {
				return moment(date).tz("Asia/Tokyo").format();
			},
		},
	}),
);
app.set("view engine", "handlebars");
app.use(handler);
app.use(
	Router.create(
		publicPath,
		systemApiClient,
		instanceClient,
		playClient,
		processClient,
		hostInfoClient,
		playlogServerHostInfoClient,
		playlogServerInfoClient,
		admin,
		dispatchRedis,
	),
);
const server = app.listen(port);

// ALB向けkeepalive設定
if (config.has("server.keepAliveTimeout")) {
	server.keepAliveTimeout = config.get<number>("server.keepAliveTimeout");
}
if (config.has("server.headersTimeout")) {
	server.headersTimeout = config.get<number>("server.headersTimeout");
}
