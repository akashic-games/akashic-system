import * as restCommons from "@akashic/akashic-rest-commons";
import { HostInfoClient, PlaylogServerHostInfoClient, PlaylogServerInfoClient, ProcessClient } from "@akashic/cluster-monitor-api-client";
import { DispatchingRedis } from "@akashic/dispatching-core";
import { SystemApiClient } from "@akashic/system-api-client";
import { InstanceClient, PlayClient } from "@akashic/system-control-api-client";
import { Logger, Log4jsAppender } from "@akashic-system/logger";
import * as express from "express";
import { getLogger } from "log4js";
import * as apiRoutes from "../controllers/api/Routes";
import * as pageRoutes from "../controllers/pages/Routes";

export function create(
	publicPath: string,
	systemApiClient: SystemApiClient,
	instanceClient: InstanceClient,
	playClient: PlayClient,
	processClient: ProcessClient,
	hostInfoClient: HostInfoClient,
	playlogServerHostInfoClient: PlaylogServerHostInfoClient,
	playlogServerInfoClient: PlaylogServerInfoClient,
	admin: boolean,
	dispatchingRedis: DispatchingRedis,
): express.IRouter {
	const apiRouter = express.Router();
	const pageRouter = express.Router();
	const router = express.Router();
	// ルーティング設定
	apiRouter.use(restCommons.NicoApiJsonResponseMiddleware);
	apiRouter.use(restCommons.JsonBodyParserMiddleware.create());
	apiRouter.use(restCommons.NoCacheMiddleware);
	restCommons.RouterUtil.routeControllers(
		apiRouter,
		apiRoutes.create(systemApiClient, instanceClient, playClient, processClient, admin, dispatchingRedis),
	);
	apiRouter.all("*", (_req, _res, next) => next(new restCommons.Errors.NotFound("route not found")));
	apiRouter.use(restCommons.NicoApiErrorHandlerMiddleware.create(new Logger([new Log4jsAppender(getLogger("error"))])));

	restCommons.RouterUtil.routeControllers(
		pageRouter,
		pageRoutes.create(
			systemApiClient,
			instanceClient,
			playClient,
			processClient,
			hostInfoClient,
			playlogServerHostInfoClient,
			playlogServerInfoClient,
		),
	);

	// staticファイル設定
	router.use(
		express.static(publicPath, {
			extensions: ["html", "htm"],
		}),
	);
	router.use("/api", apiRouter);
	router.use("/", pageRouter);
	return router;
}
