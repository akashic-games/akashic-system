import { PlayClient } from "@akashic/system-control-api-client";
import { Request, Response } from "express";

export class PlayController {
	private _client: PlayClient;

	constructor(playClient: PlayClient) {
		this._client = playClient;
	}

	public get(req: Request, res: Response, next: Function) {
		this._client
			.getPlay(req.params.id)
			.then((res) => res.data)
			.then((play) => {
				const json = JSON.stringify(play, null, "  ");
				return res.render("play", {
					play,
					json,
					admin: true,
					jsonRows: json.split("\n").length + 1,
				});
			})
			.catch((error) => next(error));
	}
}
