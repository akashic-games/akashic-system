import { IAppender } from "./Appender";
import { ILogEvent } from "./LogEvent";

/**
 * No-op and BlackHole.
 */
export class NullAppender implements IAppender {
	/**
	 * @returns 常に True
	 */
	public async append(_: ILogEvent): Promise<boolean> {
		return true;
	}
}
