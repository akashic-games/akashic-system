import { Request, Response } from "express";

export class SearchPlaysController {
	public get(_req: Request, res: Response, next: Function) {
		return new Promise(() => {
			return res.render("search", {
				target: "Plays",
				action: "plays",
				querys: [
					{
						title: "Game Code",
						name: "gameCode",
					},
					{
						title: "Status",
						name: "status",
					},
				],
			});
		}).catch((error) => next(error));
	}

	public post(req: Request, res: Response, next: Function) {
		return new Promise(() => {
			let query = "";
			let following = false;
			const keys = Object.keys(req.body);
			for (let i = 0; i < keys.length; i++) {
				if (!!req.body[keys[i]]) {
					query += following ? "&" : "?";
					query += keys[i] + "=" + global.encodeURIComponent(req.body[keys[i]]);
					following = true;
				}
			}
			return res.redirect("/plays" + query);
		}).catch((error) => next(error));
	}
}
