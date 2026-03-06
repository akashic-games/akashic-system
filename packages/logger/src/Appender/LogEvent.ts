import { LogLevel } from "./LogLevel";

export type Marker = string;
export type Context = Map<string, { toString(): string }>;

export interface ILogEvent {
	message: string;
	level: LogLevel;
	context?: Context;
	marker?: Marker;
}

export function contextToJSONString(context: Context = new Map()): string {
	return JSON.stringify([...context]);
}

export function contextToJSON(context: Context = new Map()): unknown {
	return JSON.parse(contextToJSONString(context));
}
