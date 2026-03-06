import * as express from "express";
import * as util from "util";
import { TestLogger, LogLevel } from "@akashic-system/logger";
import * as errors from "../../errors";
import * as middleware from "../NicoApiErrorHandlerMiddleware";
import { shorten } from "../shorten";

describe("NicoApiErrorHandlerMiddleware", () => {
	it("systemApiError", () => {
		const status = 404;
		const apiError = new errors.NotFound("game not found", "debug message");
		const errObj = {
			meta: {
				status,
				errorMessage: apiError.message,
				debug: util.inspect(apiError.debug),
				errorCode: apiError.errorCode,
			},
		};
		const logger = new TestLogger();
		const res: any = {
			status: (s: any) => {
				expect(s).toEqual(status);
				return res;
			},
			originalJson: (obj: any) => expect(obj).toEqual(errObj),
		};
		const m = middleware.create(logger);

		m(apiError, null as any, res as express.Response, null as any);
	});

	it("internalServerError", () => {
		const status = 500;
		const threwError = new Error();
		const apiError = new errors.InternalServerError("unhandled error", threwError);
		const errObj = {
			meta: {
				status,
				errorMessage: apiError.message,
				debug: shorten(util.inspect(apiError.debug), 1000),
				errorCode: apiError.errorCode,
			},
		};
		const logger = new TestLogger();
		const res: any = {
			status: (s: any) => {
				expect(s).toEqual(status);
				return res;
			},
			originalJson: (obj: any) => expect(obj).toEqual(errObj),
		};
		const req: any = {
			url: "/foobar",
			headers: [],
			body: "",
		};
		const m = middleware.create(logger);
		m(threwError, req, res as express.Response, null as any);
		expect(logger.hasRecords(LogLevel.ERROR)).toBeTruthy();
	});
});
