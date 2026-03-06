import * as restCommons from "@akashic/akashic-rest-commons";
import express from "express";
import * as log4js from "log4js";
import { Logger, Log4jsAppender } from "@akashic-system/logger";

import { SessionManager } from "../SessionManager";
import { DispatchedPlaysController, SessionsController } from "./Controller";

export namespace Router {
	export function create(sessionManager: SessionManager): express.Router {
		const router = express.Router();
		router.use(restCommons.NicoApiJsonResponseMiddleware);
		router.use(restCommons.JsonBodyParserMiddleware.create());
		router.use(restCommons.NoCacheMiddleware);
		// healthcheck
		router.get("/healthcheck", (req, res) => res.sendStatus(200));
		restCommons.RouterUtil.routeControllers(router, getAssignedRouters(sessionManager));
		router.all("*", (req, res, next) => next(new restCommons.Errors.NotFound("route not found")));
		router.use(restCommons.NicoApiErrorHandlerMiddleware.create(new Logger([new Log4jsAppender(log4js.getLogger("error"))])));
		return router;
	}

	function getAssignedRouters(sessionManager: SessionManager): any {
		const routes: { [key: string]: restCommons.Controller } = {
			"/v1.0/dispatched_plays/:playId/reservations": new DispatchedPlaysController(sessionManager),
			"/v1.0/sessions": new SessionsController(sessionManager),
		};
		return routes;
	}
}
