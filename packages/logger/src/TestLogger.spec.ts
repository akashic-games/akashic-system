import { Context as IContext, LogLevel } from "./Appender";
import { TestLogger } from "./TestLogger";

describe("hasRecords method", () => {
	it("should return true when have records", async () => {
		const logger = new TestLogger();
		await logger.info("foo");

		expect(logger.hasRecords(LogLevel.INFO)).toBe(true);
	});

	it("should return false when does not have records", () => {
		const logger = new TestLogger();

		expect(logger.hasRecords(LogLevel.INFO)).toBe(false);
	});
	it("should return false when does not records but have other loglevel record,", async () => {
		const logger = new TestLogger();
		await logger.debug("foo");

		expect(logger.hasRecords(LogLevel.INFO)).toBe(false);
	});
});

describe("reset method", () => {
	it("after reset, logger has not any record", async () => {
		const logger = new TestLogger();
		await logger.info("foo");

		expect(logger.hasRecords(LogLevel.INFO)).toBe(true);
		logger.reset();
		expect(logger.hasRecords(LogLevel.INFO)).toBe(false);
	});
});

describe("hasRecord method", () => {
	// 見つかるパターン
	it("should return true when have records", async () => {
		const logger = new TestLogger();
		await logger.info("foo");

		expect(logger.hasRecord({ level: LogLevel.INFO, message: "foo", context: new Map() })).toBe(true);
	});
	it("should return true when have records 2", async () => {
		const logger = new TestLogger();
		const func = () => "FooBar";
		await logger.info("foo", new Map([["foo", func]]));

		expect(logger.hasRecord({ level: LogLevel.INFO, message: "foo", context: new Map([["foo", func]]) })).toBe(true);
	});
	it("should return true when have records 3", async () => {
		const logger = new TestLogger();
		const func = () => "FooBar";
		await logger.info("foo", new Map([["foo", func]]), "a marker");

		expect(
			logger.hasRecord({
				level: LogLevel.INFO,
				message: "foo",
				context: new Map([["foo", func]]),
				marker: "a marker",
			}),
		).toBe(true);
	});

	// 見つからないパターン
	it("should return false when does not have records", () => {
		const logger = new TestLogger();

		expect(logger.hasRecord({ level: LogLevel.INFO, message: "foo", context: new Map() })).toBe(false);
	});
	it("should return false when does not have records: loglevel", async () => {
		const logger = new TestLogger();
		await logger.info("foo");

		expect(logger.hasRecord({ level: LogLevel.INFO, message: "foo", context: new Map() })).toBe(true);
	});
	it("should return false when does not have records: message", async () => {
		const logger = new TestLogger();
		await logger.info("foo");

		expect(logger.hasRecord({ level: LogLevel.INFO, message: "bar", context: new Map() })).toBe(false);
	});
	it("should return false when does not have records: context", async () => {
		const logger = new TestLogger();
		await logger.info("foo", new Map([["foo", () => "FooBar"]]));

		expect(logger.hasRecord({ level: LogLevel.INFO, message: "bar", context: new Map([["foo", () => "FooFoo"]]) })).toBe(false);
	});
	it("should return false when does not have records: marker", async () => {
		const logger = new TestLogger();
		await logger.info("foo", new Map([["foo", () => "FooBar"]]), "a marker");

		expect(
			logger.hasRecord({
				level: LogLevel.INFO,
				message: "foo",
				context: new Map([["foo", () => "FooBar"]]),
				marker: "B Marker", // not same
			}),
		).toBe(false);
	});
});

describe("hasRecordThatContains method", () => {
	// 見つかるパターン
	it("should return true when have records", async () => {
		const logger = new TestLogger();
		await logger.info("foo bar");

		expect(logger.hasRecordThatContains("foo", LogLevel.INFO)).toBe(true);
		expect(logger.hasRecordThatContains("o b", LogLevel.INFO)).toBe(true);
	});

	// 見つからないパターン
	it("should return false when does not have records", async () => {
		const logger = new TestLogger();
		await logger.info("foo bar");

		expect(logger.hasRecordThatContains("baz", LogLevel.INFO)).toBe(false);
		expect(logger.hasRecordThatContains("ob", LogLevel.INFO)).toBe(false);
	});
	it("should return false when does not records but have other loglevel record,", async () => {
		const logger = new TestLogger();
		await logger.warn("foo bar");

		expect(logger.hasRecordThatContains("foo", LogLevel.INFO)).toBe(false);
		expect(logger.hasRecordThatContains("o b", LogLevel.INFO)).toBe(false);
	});
});

describe("hasRecordThatMatches method", () => {
	// 見つかるパターン
	it("should return true when have records", async () => {
		const logger = new TestLogger();
		await logger.info("foo bar");

		expect(logger.hasRecordThatMatches(/^foo.*/, LogLevel.INFO)).toBe(true);
		expect(logger.hasRecordThatMatches(/bar$/, LogLevel.INFO)).toBe(true);
	});

	// 見つからないパターン
	it("should return false when does not have records", async () => {
		const logger = new TestLogger();
		await logger.info("foo bar");

		expect(logger.hasRecordThatMatches(/zzz/, LogLevel.INFO)).toBe(false);
	});
	it("should return false when does not records but have other loglevel record,", async () => {
		const logger = new TestLogger();
		await logger.warn("foo bar");

		expect(logger.hasRecordThatMatches(/^foo.*/, LogLevel.INFO)).toBe(false);
		expect(logger.hasRecordThatMatches(/bar$/, LogLevel.INFO)).toBe(false);
	});
});

describe("each log levels name method", () => {
	it("should be able to call", async () => {
		const logger = new TestLogger();

		await logger.trace("trace message");
		await logger.debug("debug message");
		await logger.info("info message");
		await logger.warn("warn message");
		await logger.error("error message");
		await logger.fatal("fatal message");

		expect(logger.hasRecords(LogLevel.TRACE)).toBe(true);
		expect(logger.hasRecords(LogLevel.DEBUG)).toBe(true);
		expect(logger.hasRecords(LogLevel.INFO)).toBe(true);
		expect(logger.hasRecords(LogLevel.WARN)).toBe(true);
		expect(logger.hasRecords(LogLevel.ERROR)).toBe(true);
		expect(logger.hasRecords(LogLevel.FATAL)).toBe(true);
	});
});

describe("Context Equals", () => {
	class TestTestLogger extends TestLogger {
		public static diff(a: IContext, b: IContext): boolean {
			return this.equalsContext(a, b);
		}
		public static diffWithoutArgs(): boolean {
			return this.equalsContext();
		}
	}

	it("should return true when same keys/values", () => {
		const result = TestTestLogger.diff(new Map([["foo", "foo bar"]]), new Map([["foo", "foo bar"]]));
		expect(result).toBe(true);
	});

	test("default args for usability", () => {
		const result = TestTestLogger.diffWithoutArgs();
		expect(result).toBe(true);
	});

	it("should return false when differ value", () => {
		const result = TestTestLogger.diff(new Map([["foo", "foo bar"]]), new Map([["foo", "foo Bar"]]));
		expect(result).toBe(false);
	});
	it("should return false when deffer size", () => {
		const result = TestTestLogger.diff(new Map(), new Map([["foo", "foo Bar"]]));
		expect(result).toBe(false);
	});
	it("should returns false when differ key", () => {
		const result = TestTestLogger.diff(new Map([["foo", "foo Bar"]]), new Map([["bar", "foo Bar"]]));
		expect(result).toBe(false);
	});

	it("Mapにundefinedが入っていてもエラーにならないように変更された", () => {
		// @ts-ignore
		expect(TestTestLogger.diff(new Map([["foo", "foo Bar"]]), new Map([["foo", undefined]]))).toBe(false);

		// @ts-ignore
		expect(TestTestLogger.diff(new Map([["foo", undefined]]), new Map([["foo", "foo Bar"]]))).toBe(false);
	});
});
