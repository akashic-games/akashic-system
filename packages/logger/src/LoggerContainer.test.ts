import { LoggerContainer } from "./LoggerContainer";
import { NullLogger } from "./NullLogger";

describe("LoggerContainer", () => {
	describe("get set", () => {
		it("method usage", () => {
			const container = new LoggerContainer();
			const nullLogger = new NullLogger();

			container.set("the-null-logger", nullLogger);

			expect(container.get("the-null-logger")).toBe(nullLogger);
		});
	});

	describe("get method", () => {
		it("should throw Error if try to get invalid logger", () => {
			const container = new LoggerContainer();
			expect(() => container.get("not-created-logger-key")).toThrow();
		});

		it("should returns default logger without argument", () => {
			const container = LoggerContainer.create();
			const logger = container.get();
			const defaultLogger = container.get("default");

			expect(logger).toBe(defaultLogger);
		});
	});

	describe("create method", () => {
		it("should return that contains legacy akashic system loggers", async () => {
			const loggers = LoggerContainer.create("develop");

			// 本当は default のロガーを使うべきだが、なぜか使われていない。
			// 今後はすべてこの Logger に寄せる。
			const defaultLogger = loggers.get("default");
			expect(defaultLogger).not.toBeUndefined();
			await defaultLogger.fatal("logging test: default.fatal, env = develop");
			await defaultLogger.error("logging test: default.error, env = develop");
			await defaultLogger.warn("logging test: default.warn, env = develop");
			await defaultLogger.info("logging test: default.info, env = develop");
			await defaultLogger.debug("logging test: default.debug, env = develop");
			await defaultLogger.trace("logging test: default.trace, env = develop");

			// see log4js.connectLogger implements
			// 以下のページから、 connection-logger.js というファイルを見つけることができるでしょう：
			// https://github.com/log4js-node/log4js-node/tree/master/lib
			// 正直やめてほしい。
			const accessLogger = loggers.get("access");
			expect(accessLogger).not.toBeUndefined();
			await accessLogger.info("logging test: access.info, env = develop");
			await accessLogger.warn("logging test: access.warn, env = develop");
			await accessLogger.error("logging test: access.error, env = develop");

			// stdout へ出力されるもの。
			// Akashic System の実装の多くの場所で、便利に使われている。
			// stdout 以外のところにも出力したくなるでしょうし、名前が妥当ではない。
			// この Logger を使っている箇所は全て修正対象。
			const standardOutLogger = loggers.get("out");
			expect(standardOutLogger).not.toBeUndefined();
			await standardOutLogger.trace("logging test: out.trace, env = develop");
			await standardOutLogger.info("logging test: out.info, env = develop");
			await standardOutLogger.error("logging test: out.error, env = develop");

			// エラーの捕捉用の Logger と思われるもの。
			// この Logger を使っている箇所は、すべて修正対象。
			// この Logger は削除対象。
			// default Logger 以外の Logger を生やされて、使う Logger に統一性がないと、
			//   エラーの捕捉漏れが発生するので、そういう無秩序な行為は慎んでほしい。
			const errorLogger = loggers.get("error");
			expect(errorLogger).not.toBeUndefined();
			await errorLogger.error("logging test: error.error, env = develop");
		});

		it("should return that contains legacy akashic system loggers, env is production", async () => {
			const loggers = LoggerContainer.create("production");

			const defaultLogger = loggers.get("default");
			expect(defaultLogger).not.toBeUndefined();
			await defaultLogger.fatal("logging test: default.fatal, env = production");
			await defaultLogger.error("logging test: default.error, env = production");
			await defaultLogger.warn("logging test: default.warn, env = production");
			await defaultLogger.info("logging test: default.info, env = production");
			await defaultLogger.debug("logging test: default.debug, env = production");
			await defaultLogger.trace("logging test: default.trace, env = production");

			const accessLogger = loggers.get("access");
			expect(accessLogger).not.toBeUndefined();
			await accessLogger.info("logging test: access.info, env = production");
			await accessLogger.warn("logging test: access.warn, env = production");
			await accessLogger.error("logging test: access.error, env = production");

			const standardOutLogger = loggers.get("out");
			expect(standardOutLogger).not.toBeUndefined();
			await standardOutLogger.trace("logging test: out.trace, env = production");
			await standardOutLogger.info("logging test: out.info, env = production");
			await standardOutLogger.error("logging test: out.error, env = production");

			const errorLogger = loggers.get("error");
			expect(errorLogger).not.toBeUndefined();
			await errorLogger.error("logging test: error.error, env = production");
		});

		it("should returns production logger without args", async () => {
			const loggers = LoggerContainer.create();
			const productionLoggers = LoggerContainer.create("production");

			expect(loggers).toEqual(productionLoggers);
		});
	});
});
