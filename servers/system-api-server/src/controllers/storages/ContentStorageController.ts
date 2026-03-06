import * as restCommons from "@akashic/akashic-rest-commons";
import * as Cast from "@akashic/cast-util";
import * as express from "express";
import * as ErrorConverters from "../../utils/ErrorConverters";

import ContentStorageService from "../../domain/services/ContentStorageService";

export default class ContentStorageController {
	private _contentStorageService: ContentStorageService;

	constructor(contentStorageService: ContentStorageService) {
		this._contentStorageService = contentStorageService;
	}

	/**
	 * コンテンツストレージ取得
	 * GET /v1.0/storages/content
	 */
	public get(req: express.Request, res: express.Response, next: Function): any {
		let getParams: any;
		try {
			getParams = req.query;
			getParams.limit = Cast.int(getParams.limit, true, "invalid limit");
			getParams.offset = Cast.int(getParams.offset, true, "invalid offset");

			if (getParams.playerIds && !Array.isArray(getParams.playerIds)) {
				throw new TypeError("invalid playerIds");
			}
		} catch (error) {
			return next(new restCommons.Errors.InvalidParameter("invalid read storage parameter.", error));
		}
		this._contentStorageService
			.read(getParams)
			.then(res.json)
			.catch((error: any) => {
				if (error instanceof TypeError) {
					return next(new restCommons.Errors.InvalidParameter(error.message, error));
				} else {
					throw error;
				}
			})
			.catch((error: any) => ErrorConverters.restClientErrorToApiError(error))
			.catch((error: any) => next(error));
	}

	/**
	 * コンテンツストレージ登録
	 * POST /v1.0/storages/content
	 */
	public post(req: express.Request, res: express.Response, next: Function): any {
		let body: any;
		try {
			body = req.body;
			body.min = Cast.int(body.min, true, "invalid min");
			body.max = Cast.int(body.max, true, "invalid max");

			if (!body.data || !Array.isArray(body.data)) {
				throw new TypeError("invalid data");
			}
		} catch (error) {
			return next(new restCommons.Errors.InvalidParameter("invalid write storage parameter.", error));
		}

		this._contentStorageService
			.write(body)
			.then(res.json)
			.catch((error: any) => {
				if (error instanceof TypeError) {
					return next(new restCommons.Errors.InvalidParameter(error.message, error));
				} else {
					throw error;
				}
			})
			.catch((error: any) => ErrorConverters.restClientErrorToApiError(error))
			.catch((error: any) => next(error));
	}
}
