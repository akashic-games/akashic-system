import { Context, IAppender, LogLevel, Marker } from "./Appender";
import { LoggerBase } from "./LoggerBase";

type WriteLogMethod = (message: string, context?: Context, marker?: Marker) => Promise<void>;

/**
 * ログレベルの体系。
 * このパッケージでは Syslog 系。
 */
export interface ILogger {
	/**
	 * Logger が持っている Appenders。
	 * Logger オブジェクトから別の Logger を新しく作りたい場合に取りたくなるので。
	 */
	readonly appenders: IAppender[];

	// Write Methods
	/**
	 * プログラムの異常終了を伴うようなもの
	 *
	 * コンソール等に即時出力することが想定されるものなので、メッセージ内容は簡潔にしてください。
	 */
	fatal: WriteLogMethod;
	/**
	 * 予期しない実行時エラー
	 *
	 * コンソール等に即時出力することが想定されるものなので、メッセージ内容は簡潔にしてください。
	 */
	error: WriteLogMethod;
	/**
	 * 実行時に生じた異常とは言い切れないが正常とも異なる何らかの予期しないもの
	 *
	 * ・廃止となったAPIの使用
	 * ・APIの不適切な使用
	 * ・エラーに近い事象
	 *
	 * コンソール等に即時出力することが想定されるものなので、メッセージ内容は簡潔にしてください。
	 */
	warn: WriteLogMethod;
	/**
	 * 実行時の何らかの注目すべき事象
	 *
	 * ・処理の開始/終了
	 * ・トークンの発行/失効
	 *
	 * コンソール等に即時出力することが想定されるものなので、メッセージ内容は簡潔にしてください。
	 */
	info: WriteLogMethod;
	/**
	 * デバッグ用の情報
	 *
	 * コンソールに出力せず、ログファイルなどにのみ出力されることが想定されるものです。
	 */
	debug: WriteLogMethod;
	/**
	 * Debug よりもさらに詳細な情報。
	 *
	 * 呼び出しの粒度は Debug 程度ですが、Call Stack やメモリのダンプなど、多くの冗長な情報を同時に出力することが想定されるものです。
	 */
	trace: WriteLogMethod;

	/**
	 * レベル指定呼び出し用
	 */
	writeLog(level: LogLevel, message: string, context: Context, marker?: Marker): Promise<void>;
}

/**
 * - ログレベルの体系の明示（Syslog 系）
 * - message や context の扱い方・実装
 * - 適切な message や context を作り、Appender へ渡す
 */
export class Logger extends LoggerBase implements ILogger {
	/**
	 * 常に渡される Context
	 *
	 * メソッドの引数で同じキーのものが渡された場合、引数で渡されたもので上書きされる
	 */
	public readonly context: Context = new Map();
	public readonly appenders: IAppender[];

	constructor(appenders: IAppender[] = []) {
		super();
		this.appenders = appenders;
	}

	public async writeLog(level: LogLevel, message: string, context: Context, marker?: Marker): Promise<void> {
		// 将来的に、Promise.prototype.allSettle() に置き換えると思う
		for (const appender of this.appenders) {
			await appender.append({
				message,
				level,
				context: this.mergeContext(context),
				marker,
			});
		}
	}

	/**
	 * Logger がプロパティに持っているデフォルトのコンテキストに、WriteLogMethod の引数で受け取ったコンテキストをマージする
	 *
	 * 引数で受け取る以外にも、例えば Proxy パターンなどでコンテキストを注入したり編集したりするかもしれない。
	 * そのような場合であっても「デフォルトのコンテキストを上書きする」ということになるだろう。
	 * その場合は、このメソッドを使うことになる。
	 *
	 * @param contextFromArgument
	 */
	private mergeContext(contextFromArgument: Context): Context {
		const concreteContext: Context = new Map([...this.context]);

		// うっかり間違って logger.error("hogehoge", err); とかしちゃったときのリカバリ
		contextFromArgument = contextFromArgument ?? new Map(); // null/undefined対策(jsはthrow nullとかできるので)
		if (typeof contextFromArgument.forEach !== "function") {
			contextFromArgument = new Map([["unknownContextArgument", contextFromArgument]]);
		}
		contextFromArgument.forEach((value, key) => concreteContext.set(key, value));

		return concreteContext;
	}
}
