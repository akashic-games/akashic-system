import { Database } from "@akashic/akashic-active-record";
import restCommons = require("@akashic/akashic-rest-commons");
import { ReadOnlyAliveMonitoring, ZookeeperRepository } from "@akashic/alive-monitoring-core";
import { Log4jsAppender, Logger } from "@akashic-system/logger";
import express = require("express");
import log4js = require("log4js");
import routes = require("../controllers/Routes");

//
import type { RedisCommander } from "ioredis";

function create(
	database: Database,
	aliveMonitoring: ReadOnlyAliveMonitoring,
	zkRepository: ZookeeperRepository,
	bodySizeLimit: string,
	redisRepository: RedisCommander,
): express.Router {
	const router = express.Router();
	// HTTPはすべて共通のJsonResponseを返すので、それ用のmiddlewareを入れる。
	router.use(restCommons.NicoApiJsonResponseMiddleware);
	// bodyのパーサーを入れる
	router.use(restCommons.JsonBodyParserMiddleware.create({ limit: bodySizeLimit }));
	// すべてのAPIはnocache
	router.use(restCommons.NoCacheMiddleware);
	// Routesを読み込んで設定
	restCommons.RouterUtil.routeControllers(router, routes(database, aliveMonitoring, zkRepository, redisRepository));
	// エラー処理
	// Routingできなかった物をNotFoundとする
	router.all("*", (_req, _res, next) => next(new restCommons.Errors.NotFound("route not found")));
	// エラーハンドリング用ミドルウェア
	const errorLogger = new Logger([new Log4jsAppender(log4js.getLogger("error"))]);
	router.use(restCommons.NicoApiErrorHandlerMiddleware.create(errorLogger));
	return router;
}

export = create;
