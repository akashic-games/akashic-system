import { LogLevel } from "./LogLevel";
import { TestAppender } from "./TestAppender";

describe("hasRecords method", () => {
	test("should return true when have records", async () => {
		const logger = new TestAppender();
		await logger.append({
			message: "foo",
			level: LogLevel.INFO,
		});

		expect(logger.hasRecords(LogLevel.INFO)).toBe(true);
	});

	test("should return false when does not have records", () => {
		const logger = new TestAppender();

		expect(logger.hasRecords(LogLevel.INFO)).toBe(false);
	});
	test("should return false when does not records but have other loglevel record,", async () => {
		const logger = new TestAppender();
		await logger.append({
			message: "foo",
			level: LogLevel.DEBUG,
		});

		expect(logger.hasRecords(LogLevel.INFO)).toBe(false);
	});
});

describe("reset method", () => {
	test("after reset, logger has not any record", async () => {
		const logger = new TestAppender();
		await logger.append({
			message: "foo",
			level: LogLevel.INFO,
		});

		expect(logger.hasRecords(LogLevel.INFO)).toBe(true);
		logger.reset();
		expect(logger.hasRecords(LogLevel.INFO)).toBe(false);
	});
});

describe("hasRecord method", () => {
	// 見つかるパターン
	test("should return true when have records", async () => {
		const logger = new TestAppender();
		await logger.append({
			message: "foo",
			level: LogLevel.INFO,
		});

		expect(logger.hasRecord({ level: LogLevel.INFO, message: "foo" })).toBe(true);
	});

	// 見つからないパターン
	test("should return false when does not have records", () => {
		const logger = new TestAppender();

		expect(logger.hasRecord({ level: LogLevel.WARN, message: "foo" })).toBe(false);
	});
	test("should return false when does not have records: loglevel", async () => {
		const logger = new TestAppender();
		await logger.append({
			message: "foo",
			level: LogLevel.INFO,
		});

		expect(logger.hasRecord({ level: LogLevel.WARN, message: "foo" })).toBe(false);
	});
	test("should return false when does not have records: message", async () => {
		const logger = new TestAppender();
		await logger.append({
			message: "foo",
			level: LogLevel.INFO,
		});

		expect(logger.hasRecord({ level: LogLevel.INFO, message: "bar" })).toBe(false);
	});
});

describe("hasRecordThatContains method", () => {
	// 見つかるパターン
	test("should return true when have records", async () => {
		const logger = new TestAppender();
		await logger.append({
			message: "foo bar",
			level: LogLevel.INFO,
		});

		expect(logger.hasRecordThatContains("foo", LogLevel.INFO)).toBe(true);
		expect(logger.hasRecordThatContains("o b", LogLevel.INFO)).toBe(true);
	});

	// 見つからないパターン
	test("should return false when does not have records", async () => {
		const logger = new TestAppender();
		await logger.append({
			message: "foo bar",
			level: LogLevel.INFO,
		});

		expect(logger.hasRecordThatContains("baz", LogLevel.INFO)).toBe(false);
		expect(logger.hasRecordThatContains("ob", LogLevel.INFO)).toBe(false);
	});
	test("should return false when does not records but have other loglevel record,", async () => {
		const logger = new TestAppender();
		await logger.append({
			message: "foo bar",
			level: LogLevel.WARN,
		});

		expect(logger.hasRecordThatContains("foo", LogLevel.INFO)).toBe(false);
		expect(logger.hasRecordThatContains("o b", LogLevel.INFO)).toBe(false);
	});
});

describe("hasRecordThatMatches method", () => {
	// 見つかるパターン
	test("should return true when have records", async () => {
		const logger = new TestAppender();
		await logger.append({
			message: "foo bar",
			level: LogLevel.INFO,
		});

		expect(logger.hasRecordThatMatches(/^foo.*/, LogLevel.INFO)).toBe(true);
		expect(logger.hasRecordThatMatches(/bar$/, LogLevel.INFO)).toBe(true);
	});

	// 見つからないパターン
	test("should return false when does not have records: message", async () => {
		const logger = new TestAppender();
		await logger.append({
			message: "foo bar",
			level: LogLevel.INFO,
		});

		expect(logger.hasRecordThatMatches(/zzz/, LogLevel.INFO)).toBe(false);
	});
	test("should return false when does not records: loglevel,", async () => {
		const logger = new TestAppender();
		await logger.append({
			message: "foo bar",
			level: LogLevel.WARN,
		});

		expect(logger.hasRecordThatMatches(/^foo.*/, LogLevel.INFO)).toBe(false);
		expect(logger.hasRecordThatMatches(/bar$/, LogLevel.INFO)).toBe(false);
	});
});
