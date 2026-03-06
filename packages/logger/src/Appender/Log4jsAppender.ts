import * as Log4js from "log4js";
import { IAppender } from "./Appender";
import { contextToJSONString, ILogEvent } from "./LogEvent";
import { LogLevel } from "./LogLevel";

/**
 * Log4js の Logger へ転送する Appender。
 */
export class Log4jsAppender implements IAppender {
	private readonly log4jsLogger: Log4js.Logger;

	constructor(log4jsLogger: Log4js.Logger) {
		this.log4jsLogger = log4jsLogger;

		return this;
	}

	/**
	 * @returns 常に True
	 */
	public async append(event: ILogEvent): Promise<boolean> {
		switch (event.level) {
			case LogLevel.FATAL:
				this.log4jsLogger.fatal(event.message, contextToJSONString(event.context));
				break;
			case LogLevel.ERROR:
				this.log4jsLogger.error(event.message, contextToJSONString(event.context));
				break;
			case LogLevel.WARN:
				this.log4jsLogger.warn(event.message, contextToJSONString(event.context));
				break;
			case LogLevel.INFO:
				this.log4jsLogger.info(event.message, contextToJSONString(event.context));
				break;
			case LogLevel.DEBUG:
				this.log4jsLogger.debug(event.message, contextToJSONString(event.context));
				break;
			case LogLevel.TRACE:
				this.log4jsLogger.trace(event.message, contextToJSONString(event.context));
				break;
		}

		return true;
	}
}
