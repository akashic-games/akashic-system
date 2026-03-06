import { IAppender } from "./Appender";
import { LogLevel } from "./LogLevel";
import { ILogEvent } from "./LogEvent";

export class TestAppender implements IAppender {
	public records: ILogEvent[] = [];

	public async append(event: ILogEvent): Promise<boolean> {
		this.records.push(event);

		return true;
	}

	public hasRecords(level: LogLevel): boolean {
		return this.records.find((record) => record.level === level) !== undefined;
	}

	public reset(): void {
		this.records = [];
	}

	public hasRecord(record: ILogEvent): boolean {
		return this.hasRecordThatPasses((haystack) => haystack.message === record.message, record.level);
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
