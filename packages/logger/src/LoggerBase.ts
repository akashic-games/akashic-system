import { Context, IAppender, LogLevel, Marker } from "./Appender";
import { ILogger } from "./Logger";

/**
 * LogLevel ごとに処理を分けないような、シンプルな Logger を実装するときに使う Abstract Class.
 */
export abstract class LoggerBase implements ILogger {
	public abstract readonly appenders: IAppender[];

	/**
	 * facade
	 */
	public abstract writeLog(level: LogLevel, message: string, context: Context, marker?: Marker): Promise<void>;

	/**
	 * @inheritDoc
	 */
	public async fatal(message: string, context: Context = new Map(), marker?: Marker): Promise<void> {
		await this.writeLog(LogLevel.FATAL, message, context, marker);
	}

	/**
	 * @inheritDoc
	 */
	public async error(message: string, context: Context = new Map(), marker?: Marker): Promise<void> {
		await this.writeLog(LogLevel.ERROR, message, context, marker);
	}

	/**
	 * @inheritDoc
	 */
	public async warn(message: string, context: Context = new Map(), marker?: Marker): Promise<void> {
		await this.writeLog(LogLevel.WARN, message, context, marker);
	}

	/**
	 * @inheritDoc
	 */
	public async info(message: string, context: Context = new Map(), marker?: Marker): Promise<void> {
		await this.writeLog(LogLevel.INFO, message, context, marker);
	}

	/**
	 * @inheritDoc
	 */
	public async debug(message: string, context: Context = new Map(), marker?: Marker): Promise<void> {
		await this.writeLog(LogLevel.DEBUG, message, context, marker);
	}

	/**
	 * @inheritDoc
	 */
	public async trace(message: string, context: Context = new Map(), marker?: Marker): Promise<void> {
		await this.writeLog(LogLevel.TRACE, message, context, marker);
	}
}
