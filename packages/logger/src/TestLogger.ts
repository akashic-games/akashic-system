import deepEqual from "fast-deep-equal/es6";
import { IAppender, LogLevel, Context, ILogEvent, Marker } from "./Appender";
import { ILogger } from "./Logger";
import { LoggerBase } from "./LoggerBase";

export class TestLogger extends LoggerBase implements ILogger {
	/**
	 *
	 * 使う側は ILogEvent.context をそのまま渡したいだろうから、Optional 。
	 * 空の Context と undefined を区別しない。
	 *
	 * @param a
	 * @param b
	 * @return もし同値ならば True、差分があれば False
	 */
	protected static equalsContext(a: Context = new Map(), b: Context = new Map()): boolean {
		// static method として実装してるのは筋悪。
		// おそらく、class TestContext extends Context を作って、toEquals と toBe を生やす感じにしたほうがいい気はする。
		return deepEqual(a, b);
	}

	public readonly appenders: IAppender[] = [];

	public records: ILogEvent[] = [];

	public async writeLog(level: LogLevel, message: string, context: Map<string, () => string>, marker: Marker): Promise<void> {
		this.records.push({ level, message, context, marker });
		return;
	}

	public hasRecords(level: LogLevel): boolean {
		return this.records.find((record) => record.level === level) !== undefined;
	}

	public reset(): void {
		this.records = [];
	}

	public hasRecord(record: ILogEvent): boolean {
		return this.hasRecordThatPasses((haystack) => {
			return (
				haystack.message === record.message &&
				TestLogger.equalsContext(haystack.context, record.context) &&
				haystack.marker === record.marker
			);
		}, record.level);
	}

	public hasRecordThatContains(message: string, level: LogLevel): boolean {
		return this.hasRecordThatPasses((record) => record.message.includes(message), level);
	}

	public hasRecordThatMatches(regex: RegExp, level: LogLevel): boolean {
		return this.hasRecordThatPasses((record) => regex.test(record.message), level);
	}

	public hasRecordThatPasses(predicate: (record: ILogEvent) => boolean, level: LogLevel): boolean {
		if (!this.hasRecords(level)) {
			return false;
		}
		return this.records.find(predicate) !== undefined;
	}
}
