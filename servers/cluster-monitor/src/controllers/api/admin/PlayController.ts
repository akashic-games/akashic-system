import { SystemApiClient } from "@akashic/system-api-client";
import { PlayClient } from "@akashic/system-control-api-client";
import { Request, Response } from "express";

export class DeletePlayController {
	private _client: PlayClient;
	private _admin: boolean;

	constructor(playClient: PlayClient, admin: boolean) {
		this._client = playClient;
		this._admin = admin;
	}

	public get(req: Request, res: Response, next: Function) {
		if (this._admin) {
			this._client
				.stopPlay(req.params.id)
				.then(res.json)
				.catch((error) => next(error));
		} else {
			res.status(500);
			res.json({
				error: "need admin",
			});
		}
	}
}

export class StartPlayController {
	private _client: SystemApiClient;
	private _admin: boolean;

	constructor(playClient: SystemApiClient, admin: boolean) {
		this._client = playClient;
		this._admin = admin;
	}

	public get(req: Request, res: Response, next: Function) {
		if (this._admin) {
			this._client
				.startPlay(req.params.id)
				.then(res.json)
				.catch((error) => next(error));
		} else {
			res.status(500);
			res.json({
				error: "need admin",
			});
		}
	}
}

export class PlaylogController {
	private _client: SystemApiClient;
	private _admin: boolean;

	constructor(playClient: SystemApiClient, admin: boolean) {
		this._client = playClient;
		this._admin = admin;
	}

	public get(req: Request, res: Response, next: Function) {
		if (this._admin) {
			this._client
				.getPlaylog(req.params.id)
				.then(res.json)
				.catch((error) => next(error));
		} else {
			res.status(500);
			res.json({
				error: "need admin",
			});
		}
	}
}
