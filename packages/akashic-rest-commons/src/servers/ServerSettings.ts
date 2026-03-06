import * as express from "express";
import { ILogger } from "@akashic-system/logger";

interface ServerSettings {
	listening: string | number;
	/**
	 * ログ出力にデフォルトフォーマットを使う場合に指定する
	 * logHandler が指定されていた場合は無視される
	 */
	accessLogger?: ILogger;
	/**
	 * ログ出力用のハンドラを指定する
	 * accessLogger か logHandler のいずれかが指定されていなければならない
	 */
	logHandler?: express.Handler;
	router: express.Router;
	key?: string;
	cert?: string;
	middlewares?: express.Handler[];
}
export = ServerSettings;
