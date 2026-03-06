import { LogLevel, ILogEvent, TestAppender } from "./Appender";
import { Logger } from "./Logger";

describe("Logger class", () => {
	test("message building", async () => {
		const testAppender = new TestAppender();
		const logger = new Logger([testAppender]);

		logger.context.set("foo", () => "FooBar");
		logger.context.set("foo bar", () => "dog cat");

		await logger.info("I am message");

		const expectRecord: ILogEvent = {
			level: LogLevel.INFO,
			message: "I am message",
			context: new Map([
				["foo", "FooBar"],
				["foo bar", "dog cat"],
			]),
		};

		expect(testAppender.hasRecord(expectRecord)).toBe(true);
	});
});
