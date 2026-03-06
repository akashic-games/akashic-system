import { ErrorRequestHandler, Request, Response } from "express";
import { inspect } from "util";
import { ILogger } from "@akashic-system/logger";
import { ApiError, InternalServerError } from "../errors";
import { shorten } from "./shorten";
/**
 * ニコニコシステム間APIのエラーハンドリングに使用にするためのMiddlewareを作成
 * NicoAPiJsonResponseMiddlewareと一緒に使うことを想定
 * @type req {express.Request}
 * @type res {express.Response}
 * @type next {Function}
 */

export function create(errorLogger: ILogger, maxDebugLength?: number): ErrorRequestHandler {
	const maxLength: number = maxDebugLength ? maxDebugLength : 1000;
	return (err: any, req: Request, res: Response, _: Function): any => {
		let apiError: ApiError;
		if (!(err instanceof ApiError)) {
			const errorDebugString = shorten(
				inspect({
					url: req.url,
					header: req.headers,
					body: req.body,
				}),
				maxLength,
			);
			errorLogger.error("info: " + errorDebugString, new Map([["error", err]]));
			apiError = new InternalServerError("unhandled error", err);
		} else {
			apiError = err;
		}
		const debugString = shorten(inspect(apiError.debug), maxLength);
		(res.status(apiError.status) as any).originalJson({
			meta: {
				status: apiError.status,
				errorCode: apiError.errorCode,
				debug: debugString,
				errorMessage: apiError.message,
			},
		});
	};
}
