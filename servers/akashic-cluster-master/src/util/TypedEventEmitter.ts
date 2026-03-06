import { EventEmitter } from "events";

/**
 * 型付きEventEmitter
 * https://github.com/DefinitelyTyped/DefinitelyTyped/pull/44811 の変更が入るまでのつなぎ実装
 * masterだけに影響範囲を抑えるためにmaster下に配置
 */
export interface TypedEventEmitter<EventMap> {
	addListener<K extends keyof EventMap>(event: K, listener: (arg: EventMap[K]) => void): this;
	on<K extends keyof EventMap>(event: K, listener: (arg: EventMap[K]) => void): this;
	once<K extends keyof EventMap>(event: K, listener: (arg: EventMap[K]) => void): this;
	prependListener<K extends keyof EventMap>(event: K, listener: (arg: EventMap[K]) => void): this;
	prependOnceListener<K extends keyof EventMap>(event: K, listener: (arg: EventMap[K]) => void): this;
	removeListener<K extends keyof EventMap>(event: K, listener: (arg: EventMap[K]) => void): this;
	off<K extends keyof EventMap>(event: K, listener: (arg: EventMap[K]) => void): this;
	removeAllListeners<K extends keyof EventMap>(event?: K): this;
	setMaxListeners(n: number): this;
	getMaxListeners(): number;
	listeners<K extends keyof EventMap>(event: K): ((arg: EventMap[K]) => void)[];
	rawListeners<K extends keyof EventMap>(event: K): ((arg: EventMap[K]) => void)[];
	emit<K extends keyof EventMap>(event: K, args: EventMap[K]): boolean;
	eventNames(): (keyof EventMap)[];
	listenerCount<K extends keyof EventMap>(type: K): number;
}

export interface TypedEventEmitterClass {
	new <T>(): TypedEventEmitter<T>;
	defaultMaxListeners: number;
}
// jsコード上の実体としては TypedEventEmitter === EventEmitter
export const TypedEventEmitter: TypedEventEmitterClass = EventEmitter as unknown as TypedEventEmitterClass;
