import { ILogger } from "./Logger";
import { NullLogger } from "./NullLogger";

// tslint:disable-next-line:no-any
type constructor<T extends {}> = new (...args: any[]) => T;

export interface ILoggerAware {
	logger: ILogger;
}

export class LoggerAware implements ILoggerAware {
	public logger: ILogger = new NullLogger();
}

export function LoggerAwareTrait<T extends constructor<{}>>(target: T): T & constructor<ILoggerAware> {
	// tslint:disable-next-line:max-classes-per-file
	return class NewTarget extends target implements ILoggerAware {
		public logger: ILogger = new NullLogger();
	};
}
