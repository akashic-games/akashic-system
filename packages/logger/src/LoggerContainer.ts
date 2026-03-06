import * as log4js from "log4js";
import { Context, Log4jsAppender } from "./Appender";
import { ILogger, Logger } from "./Logger";

const categories = ["default", "out", "access", "error"] as const;

export function context(src: { [K: string]: { toString(): string } }): Context {
	const concreteContext: Context = new Map();
	for (const key in src) {
		if (!src.hasOwnProperty(key)) {
			continue;
		}
		concreteContext.set(key, src[key]);
	}

	return concreteContext;
}

export class LoggerContainer {
	/**
	 * 既存の log4js を直接使ったコードを置き換えるときに便利な Factory Method
	 */
	public static create(nodeEnv: string = "production"): LoggerContainer {
		const loggers: Map<(typeof categories)[number], ILogger> = new Map();

		// Akashic System はテストがないレガシーアプリケーションなので、本番環境でも info くらいはほしい
		const defaultLogLevel = nodeEnv === "production" ? "info" : "trace";

		log4js.configure({
			appenders: {
				// わざわざ型を明示する理由は、 Appender によって設定項目が違うから。
				access: { type: "console", layout: { type: "basic" } } as log4js.ConsoleAppender,
				out: { type: "console", layout: { type: "basic" } } as log4js.ConsoleAppender,
				error: { type: "console", layout: { type: "basic" } } as log4js.ConsoleAppender,
			},
			// log4js.getLogger するときの引数が categories
			categories: {
				default: { appenders: ["out"], level: defaultLogLevel },
				access: { appenders: ["access"], level: defaultLogLevel },
				out: { appenders: ["out"], level: defaultLogLevel },
				error: { appenders: ["error"], level: defaultLogLevel },
			},
		});

		for (const category of categories) {
			const logger = new Logger([new Log4jsAppender(log4js.getLogger(category))]);
			loggers.set(category, logger);
		}

		return new LoggerContainer(loggers);
	}

	public static createLogger(nodeEnv: string): ILogger {
		return this.create(nodeEnv).get("default");
	}

	/**
	 * 式中に throw 文 を書きたい場合に使うメソッド。
	 *
	 * @throws
	 */
	private static throwAppenderIsNotExistsException(key: string): never {
		throw new Error(`Logic Exception: ${key} logger has not created.`);
	}

	private readonly logger: Map<(typeof categories)[number] | string, ILogger>;

	constructor(appenders: Map<(typeof categories)[number], ILogger> = new Map()) {
		this.logger = new Map(appenders.entries());
	}

	public set(key: string, logger: ILogger): this {
		this.logger.set(key, logger);

		return this;
	}

	/**
	 * @throws Error
	 */
	public get(key: (typeof categories)[number] | string = "default"): ILogger {
		return this.logger.get(key) || LoggerContainer.throwAppenderIsNotExistsException(key);
	}
}
