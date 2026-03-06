import { Request, Response } from "express";
import { createSearchRedirectUrl } from "../../../utils/Url";

export class SearchReportsController {
	public get(_req: Request, res: Response, next: Function) {
		return new Promise(() => {
			return res.render("search", {
				target: "Reports",
				action: "reports",
				querys: [
					{
						title: "File",
						name: "file",
					},
					{
						title: "Instance Id",
						name: "instanceId",
					},
					{
						title: "timestamp From (JavascriptのDateで認識できる文字列)",
						name: "since",
					},
					{
						title: "timestamp To (JavascriptのDateで認識できる文字列)",
						name: "until",
					},
					{
						title: "Message (*でワイルドカードが使えます。*cpp*200*のように文字列と数値を同時に含むことはできません)",
						name: "message",
					},
					{
						title: "Tag",
						name: "tag",
					},
					{
						title: "Level (WARN INFO ERROR など)",
						name: "level",
					},
					{
						title: "Logger (out access など)",
						name: "logger",
					},
				],
			});
		}).catch((error) => next(error));
	}

	public post(req: Request, res: Response, next: Function) {
		return new Promise(() => {
			return res.redirect(createSearchRedirectUrl("/reports", req.body));
		}).catch((error) => next(error));
	}
}
