import * as log4js from "log4js";
import * as util from "util";
import * as ct from "./Constants";

export interface Event {
	action: string;
	event: string;
}

export class LogUtil {
	private _baseLogger: log4js.Logger;
	private _auxInfo: any;

	get baseLogger() {
		return this._baseLogger;
	}

	constructor(baseLogger: log4js.Logger, auxInfo?: any) {
		this._baseLogger = baseLogger;
		this._auxInfo = auxInfo;
	}

	public setAuxInfo(auxInfo: any): void {
		this._auxInfo = auxInfo;
	}

	// log4js compatible methods
	public trace(msg: string, ...args: any[]): void {
		this._outputLog(this._baseLogger.trace, msg, null, null, args);
	}

	public debug(msg: string, ...args: any[]): void {
		this._outputLog(this._baseLogger.debug, msg, null, null, args);
	}

	public info(msg: string, ...args: any[]): void {
		this._outputLog(this._baseLogger.info, msg, null, null, args);
	}

	public warn(msg: string, ...args: any[]): void {
		this._outputLog(this._baseLogger.warn, msg, null, null, args);
	}

	public error(msg: string, ...args: any[]): void {
		this._outputLog(this._baseLogger.error, msg, null, null, args);
	}

	public fatal(msg: string, ...args: any[]): void {
		this._outputLog(this._baseLogger.fatal, msg, null, null, args);
	}

	// logging with auxiliary info methods
	public traceWithAux(msg: string, auxInfo: any, ...args: any[]): void {
		this._outputLog(this._baseLogger.trace, msg, auxInfo, null, args);
	}

	public debugWithAux(msg: string, auxInfo: any, ...args: any[]): void {
		this._outputLog(this._baseLogger.debug, msg, auxInfo, null, args);
	}

	public infoWithAux(msg: string, auxInfo: any, ...args: any[]): void {
		this._outputLog(this._baseLogger.info, msg, auxInfo, null, args);
	}

	public warnWithAux(msg: string, auxInfo: any, ...args: any[]): void {
		this._outputLog(this._baseLogger.warn, msg, auxInfo, null, args);
	}

	public errorWithAux(msg: string, auxInfo: any, ...args: any[]): void {
		this._outputLog(this._baseLogger.error, msg, auxInfo, null, args);
	}

	public fatalWithAux(msg: string, auxInfo: any, ...args: any[]): void {
		this._outputLog(this._baseLogger.fatal, msg, auxInfo, null, args);
	}

	// log methods for a start event
	public traceStart(action: string, msg: string, ...args: any[]): void {
		this._logStartEvent(this._baseLogger.trace, action, msg, {}, args);
	}

	public debugStart(action: string, msg: string, ...args: any[]): void {
		this._logStartEvent(this._baseLogger.debug, action, msg, {}, args);
	}

	public infoStart(action: string, msg: string, ...args: any[]): void {
		this._logStartEvent(this._baseLogger.info, action, msg, {}, args);
	}

	public warnStart(action: string, msg: string, ...args: any[]): void {
		this._logStartEvent(this._baseLogger.warn, action, msg, {}, args);
	}

	public errorStart(action: string, msg: string, ...args: any[]): void {
		this._logStartEvent(this._baseLogger.error, action, msg, {}, args);
	}

	public fatalStart(action: string, msg: string, ...args: any[]): void {
		this._logStartEvent(this._baseLogger.fatal, action, msg, {}, args);
	}

	// log methods for a start event with aux info
	public traceStartWithAux(action: string, msg: string, auxInfo: any, ...args: any[]): void {
		this._logStartEvent(this._baseLogger.trace, action, msg, auxInfo, args);
	}

	public debugStartWithAux(action: string, msg: string, auxInfo: any, ...args: any[]): void {
		this._logStartEvent(this._baseLogger.debug, action, msg, auxInfo, args);
	}

	public infoStartWithAux(action: string, msg: string, auxInfo: any, ...args: any[]): void {
		this._logStartEvent(this._baseLogger.info, action, msg, auxInfo, args);
	}

	public warnStartWithAux(action: string, msg: string, auxInfo: any, ...args: any[]): void {
		this._logStartEvent(this._baseLogger.warn, action, msg, auxInfo, args);
	}

	public errorStartWithAux(action: string, msg: string, auxInfo: any, ...args: any[]): void {
		this._logStartEvent(this._baseLogger.error, action, msg, auxInfo, args);
	}

	public fatalStartWithAux(action: string, msg: string, auxInfo: any, ...args: any[]): void {
		this._logStartEvent(this._baseLogger.fatal, action, msg, auxInfo, args);
	}

	// log methods for an end event
	public traceEnd(action: string, msg: string, ...args: any[]): void {
		this._logEndEvent(this._baseLogger.trace, action, msg, {}, args);
	}

	public debugEnd(action: string, msg: string, ...args: any[]): void {
		this._logEndEvent(this._baseLogger.debug, action, msg, {}, args);
	}

	public infoEnd(action: string, msg: string, ...args: any[]): void {
		this._logEndEvent(this._baseLogger.info, action, msg, {}, args);
	}

	public warnEnd(action: string, msg: string, ...args: any[]): void {
		this._logEndEvent(this._baseLogger.warn, action, msg, {}, args);
	}

	public errorEnd(action: string, msg: string, ...args: any[]): void {
		this._logEndEvent(this._baseLogger.error, action, msg, {}, args);
	}

	public fatalEnd(action: string, msg: string, ...args: any[]): void {
		this._logEndEvent(this._baseLogger.fatal, action, msg, {}, args);
	}

	// log methods for an end event with aux info
	public traceEndWithAux(action: string, msg: string, auxInfo: any, ...args: any[]): void {
		this._logEndEvent(this._baseLogger.trace, action, msg, auxInfo, args);
	}

	public debugEndWithAux(action: string, msg: string, auxInfo: any, ...args: any[]): void {
		this._logEndEvent(this._baseLogger.debug, action, msg, auxInfo, args);
	}

	public infoEndWithAux(action: string, msg: string, auxInfo: any, ...args: any[]): void {
		this._logEndEvent(this._baseLogger.info, action, msg, auxInfo, args);
	}

	public warnEndWithAux(action: string, msg: string, auxInfo: any, ...args: any[]): void {
		this._logEndEvent(this._baseLogger.warn, action, msg, auxInfo, args);
	}

	public errorEndWithAux(action: string, msg: string, auxInfo: any, ...args: any[]): void {
		this._logEndEvent(this._baseLogger.error, action, msg, auxInfo, args);
	}

	public fatalEndWithAux(action: string, msg: string, auxInfo: any, ...args: any[]): void {
		this._logEndEvent(this._baseLogger.fatal, action, msg, auxInfo, args);
	}

	// log methods for an abort event
	public traceAbort(action: string, msg: string, ...args: any[]): void {
		this._logAbortEvent(this._baseLogger.trace, action, msg, {}, args);
	}

	public debugAbort(action: string, msg: string, ...args: any[]): void {
		this._logAbortEvent(this._baseLogger.debug, action, msg, {}, args);
	}

	public infoAbort(action: string, msg: string, ...args: any[]): void {
		this._logAbortEvent(this._baseLogger.info, action, msg, {}, args);
	}

	public warnAbort(action: string, msg: string, ...args: any[]): void {
		this._logAbortEvent(this._baseLogger.warn, action, msg, {}, args);
	}

	public errorAbort(action: string, msg: string, ...args: any[]): void {
		this._logAbortEvent(this._baseLogger.error, action, msg, {}, args);
	}

	public fatalAbort(action: string, msg: string, ...args: any[]): void {
		this._logAbortEvent(this._baseLogger.fatal, action, msg, {}, args);
	}

	// log methods for an abort event with aux info
	public traceAbortWithAux(action: string, msg: string, auxInfo: any, ...args: any[]): void {
		this._logAbortEvent(this._baseLogger.trace, action, msg, auxInfo, args);
	}

	public debugAbortWithAux(action: string, msg: string, auxInfo: any, ...args: any[]): void {
		this._logAbortEvent(this._baseLogger.debug, action, msg, auxInfo, args);
	}

	public infoAbortWithAux(action: string, msg: string, auxInfo: any, ...args: any[]): void {
		this._logAbortEvent(this._baseLogger.info, action, msg, auxInfo, args);
	}

	public warnAbortWithAux(action: string, msg: string, auxInfo: any, ...args: any[]): void {
		this._logAbortEvent(this._baseLogger.warn, action, msg, auxInfo, args);
	}

	public errorAbortWithAux(action: string, msg: string, auxInfo: any, ...args: any[]): void {
		this._logAbortEvent(this._baseLogger.error, action, msg, auxInfo, args);
	}

	public fatalAbortWithAux(action: string, msg: string, auxInfo: any, ...args: any[]): void {
		this._logAbortEvent(this._baseLogger.fatal, action, msg, auxInfo, args);
	}

	private _formatMessage(msg: string, auxInfo: any | null, event: Event | null, args: any[]): string {
		const result: any = {};
		result[ct.logTagMessage] = util.format.apply(util, [msg, args]);

		if (auxInfo) {
			for (const key in auxInfo) {
				if (auxInfo.hasOwnProperty(key)) {
					result[key] = auxInfo[key];
				}
			}
		}

		if (this._auxInfo) {
			for (const key in this._auxInfo) {
				if (this._auxInfo.hasOwnProperty(key)) {
					result[key] = this._auxInfo[key];
				}
			}
		}

		if (event) {
			result[ct.logTagAction] = event.action;
			result[ct.logTagEvent] = event.event;
		}

		return JSON.stringify(result);
	}

	private _outputLog(func: (msg: string, args: any[]) => void, msg: string, auxInfo: any | null, event: Event | null, args: any[]): void {
		// いったん全ての args を自前で format
		const nextArgs: string = this._formatMessage(msg, auxInfo, event, args);
		// log4js で stack trace 出してほしいので Error だけ log4js に渡す
		const errors: Error[] = args.filter((arg) => {
			return arg instanceof Error;
		});

		func.apply(this._baseLogger, [nextArgs, errors]);
	}

	private _logStartEvent(func: (msg: string, args: any[]) => void, action: string, msg: string, auxInfo: any, args: any[]): void {
		this._outputLog(func, msg, auxInfo, { action, event: ct.logEventStart }, args);
	}

	private _logEndEvent(func: (msg: string, args: any[]) => void, action: string, msg: string, auxInfo: any, args: any[]): void {
		this._outputLog(func, msg, auxInfo, { action, event: ct.logEventEnd }, args);
	}

	private _logAbortEvent(func: (msg: string, args: any[]) => void, action: string, msg: string, auxInfo: any, args: any[]): void {
		this._outputLog(func, msg, auxInfo, { action, event: ct.logEventAbort }, args);
	}
}
