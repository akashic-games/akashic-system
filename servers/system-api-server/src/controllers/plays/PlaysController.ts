import * as restCommons from "@akashic/akashic-rest-commons";
import * as Cast from "@akashic/cast-util";
import { LoggerAware } from "@akashic-system/logger";
import * as express from "express";
import PlayServerService from "../../domain/services/PlayServerService";
import * as ErrorConverters from "../../utils/ErrorConverters";

export default class PlaysController extends LoggerAware {
	private client: PlayServerService;

	constructor(play: PlayServerService) {
		super();
		this.client = play;
	}

	/**
	 * プレー一覧取得
	 * GET /v1.0/plays/
	 */
	public get(req: express.Request, res: express.Response, next: Function): any {
		let getParams: any;

		try {
			getParams = {
				_limit: Cast.int(req.query._limit, true, "invalid _limit"),
				_count: Cast.int(req.query._count, true, "invalid _count"),
				_offset: Cast.int(req.query._offset, true, "invalid _offset"),
				order: Cast.string(req.query.order, undefined, true, "invalid order"),
				gameCode: Cast.string(req.query.gameCode, undefined, true, "invalid gameCode"),
			};

			// extract params
			Object.keys(getParams).forEach((key: string) => {
				if (getParams[key] === undefined) {
					delete getParams[key];
				}
			});

			// validate status
			if (!Array.isArray(req.query.status) && typeof req.query.status !== "undefined") {
				throw new Error("parameter status is not valid");
			}
			if (req.query.status) {
				getParams.status = (req.query.status as string[])
					.map((item: any, index: number) => {
						return Cast.string(item, undefined, true, `invalid status[${index}]`);
					})
					.filter((e?: string) => !!e);
			}
		} catch (error) {
			return next(new restCommons.Errors.InvalidParameter("invalid parameter", error));
		}

		if (getParams._limit === undefined) {
			getParams._limit = 10;
		}
		if (getParams._limit > 100) {
			return next(new restCommons.Errors.InvalidParameter("invalid parameter", "max _limit is 100"));
		}

		this.client
			.getPlays(getParams)
			.then(res.json)
			.catch((error: any) => ErrorConverters.restClientErrorToApiError(error))
			.catch((error: any) => next(error));
	}

	/**
	 * プレー作成
	 * POST /v1.0/plays/
	 */
	public async post(req: express.Request, res: express.Response, next: Function): Promise<any> {
		let gameCode: string;
		let parentId: string;
		let parentData: string;
		let parentFrame: number;
		let ignorablePlayData: string;
		let providerType: string;

		try {
			gameCode = Cast.uriUnreserved(req.body.gameCode, 64, true, "gameCode is not valid");

			if (req.body.parent) {
				parentId = Cast.bigint(req.body.parent.playId, true, "invliad parent playId");
				parentData = Cast.string(req.body.parent.playData, undefined, true, "invalid parent playData");
				parentFrame = Cast.number(req.body.parent.frame, true, "invalid parent frame number");
				ignorablePlayData = Cast.string(req.body.parent.ignorablePlayData, undefined, true, "invalid parent playData");
			}
			if (req.body.nicoliveMetadata) {
				providerType = Cast.string(req.body.nicoliveMetadata.providerType, undefined, true);
				const metadata = JSON.stringify(req.body.nicoliveMetadata);
				this.logger.info("nicolive metadata. " + metadata);
			}
		} catch (error) {
			return next(new restCommons.Errors.InvalidParameter("invalid parameter", error));
		}
		try {
			const play = await this.client.createPlay({
				gameCode,
				parent: { playId: parentId, playData: parentData, frame: parentFrame, ignorablePlayData },
			});
			if (providerType) {
				try {
					this.client.addPlaysNicoliveMetadata(play.id, providerType);
				} catch (error) {
					this.logger.warn(`Error: ${error}: APIとしては成功扱いとして続行します`);
				}
			}
			res.json(play);
		} catch (error) {
			const apiError = await ErrorConverters.restClientErrorToApiError(error);
			next(apiError);
		}
	}
}
