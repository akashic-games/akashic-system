import * as restCommons from "@akashic/akashic-rest-commons";
import * as express from "express";
import * as log4js from "log4js";
import { Logger, Log4jsAppender } from "@akashic-system/logger";
import SystemControlClient from "../clients/SystemControlClient";
import routes from "../controllers/Routes";
import { DispatcherBase } from "../services/DispatcherBase";

export default async function create(
	dispatcher: DispatcherBase,
	client: SystemControlClient,
	bodySizeLimit: string,
): Promise<express.Router> {
	const router: express.Router = express.Router();

	// ミドルウェアの登録
	// HTTPはすべて共通のJsonResponseを返すので、それ用のmiddlewareを入れる。
	router.use(restCommons.NicoApiJsonResponseMiddleware);
	// bodyのパーサーを入れる
	router.use(restCommons.JsonBodyParserMiddleware.create({ limit: bodySizeLimit }));
	// すべてのAPIはnocache
	router.use(restCommons.NoCacheMiddleware);

	// routes
	// healthcheck
	router.use("/healthcheck", express.static(process.cwd() + "/static/healthcheck"));
	router.use("/healthcheck/status", express.static(process.cwd() + "/static/healthcheck_status"));
	// Routesを読み込んで設定
	// この関数は、Router に対してメタプログラミングを用いてルートの追加をしており、またその状態を破壊してはいけない。
	// express.Router に生えているメソッドでパスなどを指定して直接ルートを追加する場合は、ここよりも前に行う必要がある。
	restCommons.RouterUtil.routeControllers(router, await routes(dispatcher, client));

	// エラー処理
	// Routingできなかった物をNotFoundとする
	router.all("*", (_req, _res, next) => next(new restCommons.Errors.NotFound("route not found")));
	// エラーハンドリング用ミドルウェア
	const errorLogger = log4js.getLogger("error");
	router.use(restCommons.NicoApiErrorHandlerMiddleware.create(new Logger([new Log4jsAppender(errorLogger)])));
	return router;
}
