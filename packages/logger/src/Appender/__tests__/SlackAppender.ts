import { LogLevel, SlackAppender } from "..";

test("basic usage", async () => {
	const appender = SlackAppender.create();

	// fatal - warn
	await appender.append({
		message: "fatal message",
		level: LogLevel.FATAL,
		context: new Map(),
	});
	await appender.append({
		message: "error message",
		level: LogLevel.ERROR,
		context: new Map(),
	});
	await appender.append({
		message: "warn message",
		level: LogLevel.WARN,
		context: new Map(),
	});

	// info 以下は無視される
	await appender.append({
		message: "info message",
		level: LogLevel.INFO,
		context: new Map(),
	});
	await appender.append({
		message: "debug message",
		level: LogLevel.DEBUG,
		context: new Map(),
	});
	await appender.append({
		message: "trace message",
		level: LogLevel.TRACE,
		context: new Map(),
	});
});
