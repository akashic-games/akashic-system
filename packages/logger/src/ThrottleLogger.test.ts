import { ThrottleLogger } from "./ThrottleLogger";
import { TestAppender } from "./Appender";

describe("ThrottleLogger", () => {
	it("should create with empty appenders without args", () => {
		const logger = new ThrottleLogger();
		expect(logger.appenders.length).toBe(0);
	});

	test("basic usage", async () => {
		jest.useFakeTimers();

		const appender = new TestAppender();
		const logger = new ThrottleLogger([appender]);

		// 1回目は普通に append される
		await logger.info("test message");
		expect(appender.records.length).toBe(1);

		// まだそんなに時間が経っていないので、これは無視される
		await logger.info("test message");
		expect(appender.records.length).toBe(1);

		// 時間が経つと、
		jest.advanceTimersByTime(logger.ttlMilliSec);
		// また同じログも append される
		await logger.info("test message");
		expect(appender.records.length).toBe(2);
	});

	it("contextが同じ場合(関数の場合は参照比較)はThrottleLoggerは出力しない", async () => {
		jest.useFakeTimers();

		const appender = new TestAppender();
		const logger = new ThrottleLogger([appender]);

		const func = () => "FooBar";
		// 1回目は普通にappendされる
		await logger.info("test", new Map([["f", func]]));
		expect(appender.records.length).toBe(1);

		// 同じ参照なので無視される
		await logger.info("test", new Map([["f", func]]));
		expect(appender.records.length).toBe(1);

		// 同じ関数だが違う参照なのでappendされる
		await logger.info("test", new Map([["f", () => "FooBar"]]));
		expect(appender.records.length).toBe(2);
	});
});
