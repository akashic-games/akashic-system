import deepEqual from "fast-deep-equal/es6";

import { LoggerBase } from "./LoggerBase";
import { ILogger } from "./Logger";
import { Context, IAppender, ILogEvent, LogLevel, Marker } from "./Appender";

export class ThrottleLogger extends LoggerBase implements ILogger {
	public readonly appenders: IAppender[];

	/**
	 * この秒数の間に1度だけ Appenders へ渡される。
	 */
	public ttlMilliSec: number = 30 * 1000;

	/**
	 * Appenders へ渡さずに無視されるべき Log Event。
	 *
	 * Set 型は Same Value Zero で比較されてしまうので使用できない。
	 */
	protected readonly memento: ILogEvent[] = [];

	public constructor(appenders: IAppender[] = []) {
		super();
		this.appenders = appenders;
	}

	public async writeLog(level: LogLevel, message: string, context: Context, marker?: Marker): Promise<void> {
		const event: ILogEvent = { level, message, context, marker };

		if (this.memento.find((haystack) => deepEqual(haystack, event))) {
			return;
		}

		this.memento.push(event); // 削除するときに先頭から探す（と思う）ので、末尾に追加したほうがいい気がする
		setTimeout(() => {
			// 削除するロジック
			// array filter で新しく配列を作成して再代入することも考えたが、
			// - 削除される要素は1つしかないこと
			// - 配列の先頭に近いところに存在する
			// という点を考えると、素直に検索して削除するのが安定して速いだろう。
			const targetIndex = this.memento.findIndex((haystack) => deepEqual(haystack, event));
			delete this.memento[targetIndex];
		}, this.ttlMilliSec);

		for (const appender of this.appenders) {
			await appender.append(event);
		}
	}
}
