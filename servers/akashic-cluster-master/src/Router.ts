import * as restCommons from "@akashic/akashic-rest-commons";
import * as express from "express";
import * as log4js from "log4js";
import { Logger, Log4jsAppender } from "@akashic-system/logger";
import * as routes from "./Routes";

export function create(
	instanceManager: import("./master/controls/InstanceManager").InstanceManager,
	masterController: import("./core").MasterController,
): express.Router {
	const router = express.Router();
	// HTTPはすべて共通のJsonResponseを返すので、それ用のmiddlewareを入れる。
	router.use(restCommons.NicoApiJsonResponseMiddleware);

	// bodyのパーサーを入れる
	router.use(restCommons.JsonBodyParserMiddleware.create());

	// すべてのAPIはnocache
	router.use(restCommons.NoCacheMiddleware);

	// healthcheck
	router.use("/healthcheck", express.static(process.cwd() + "/static/healthcheck"));

	// Routesを読み込んで設定
	restCommons.RouterUtil.routeControllers(router, routes.getRouteSettings(instanceManager, masterController));

	// エラー処理
	// Routingできなかった物をNotFoundとする
	router.all("*", (_req, _res, next) => next(new restCommons.Errors.NotFound("route not found")));

	// エラーハンドリング用ミドルウェア
	const errorLogger = new Logger([new Log4jsAppender(log4js.getLogger("error"))]);
	router.use(restCommons.NicoApiErrorHandlerMiddleware.create(errorLogger));

	return router;
}
