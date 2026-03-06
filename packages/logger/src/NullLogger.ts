import { IAppender } from "./Appender";
import { ILogger } from "./Logger";
import { LoggerBase } from "./LoggerBase";

/**
 * 受け取った Log をすべて捨てる Logger。
 */
export class NullLogger extends LoggerBase implements ILogger {
	public readonly appenders: IAppender[] = [];

	public async writeLog(): Promise<void> {
		// noop
	}
}
