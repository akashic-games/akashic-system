/**
 * JSONをパースするBodyParser
 * 通常のbody-parserを改良したもの。
 * 理由はbody-parserがパース失敗時にnext(new Error)をコールしてしまい、
 * エラーハンドラ側はパースに失敗したのか内部エラーかわからないので
 * それを防ぐためにnext(new BadRequest())をコールして区別できるようにしている
 */
import * as bodyParser from "body-parser";
import { Request, Response } from "express";
import { BadRequest } from "../errors";

export function create(options?: any) {
	const parser = bodyParser.json(options);
	const jsonBodyParser = (req: Request, res: Response, next: Function): any => {
		parser(req, res, (err?: any) => {
			if (err) {
				return next(new BadRequest("cannot parse request body", err));
			}
			next();
		});
	};
	return jsonBodyParser;
}
