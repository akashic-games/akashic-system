import { Logger, Log4jsAppender, ILogger } from "@akashic-system/logger";
import * as log4js from "log4js";
/**
 * LogUtil を引き回すためのラッパ
 */
export class LogFactory {
	public getLogger(categoryName: string, auxInfo?: { [K: string]: string }): ILogger {
		const logger = new Logger([new Log4jsAppender(log4js.getLogger(categoryName))]);
		if (auxInfo) {
			Object.entries(auxInfo).forEach(([key, value]) => logger.context.set(key, value));
		}
		return logger;
	}
}
