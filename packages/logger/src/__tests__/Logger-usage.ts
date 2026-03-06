import { context, ILogger, ILogEvent, Logger, LoggerContainer, LogLevel, TestAppender } from "../";

test("basic logger library usage", async () => {
	const logger = LoggerContainer.createLogger("develop");

	await logger.warn("warning message example");
	await logger.info("access", context({ path: "/user/0002" }));
});

test("既存のコードでコンテキストを含む Logging の置き換え例", async () => {
	const loggerContainer = LoggerContainer.create(process.env.NODE_ENV);

	// 各ドメインロジッククラスの中で、渡された Logger を wrap する
	class DomainLogicClass {
		public logger: ILogger = new Logger(); // 典型的な NullObject パターン {の実装, を使った設計にすべき機会} の例

		public async doSomething(path: string): Promise<void> {
			// e.g.
			// この処理では、渡された `path` を常に context としてログに含めたいので、
			// 「context を含めたメッセージを生成する」 Logger で、 `this.logger` をラップする。
			const logger = new Logger(this.logger.appenders);
			logger.context.set("path", () => path);

			await logger.info("done something.");

			return;
		}
	}

	// 例えば「この処理はプレ垢への影響が出やすいので Elastic Search へログを送信したい」みたいなときに放り込む、
	//   Elastic Search Logger みたいなやつだと思ってくれ。
	// 「どこになんの Logger を入れておくか？」は、Laravel 用語の "Service Provider" にまとめておけば良い。
	//
	// Service Provider に書かれる処理の例 ここから
	const testAppender = new TestAppender();
	const service = new DomainLogicClass();
	const appenders = loggerContainer.get("default").appenders;
	service.logger = new Logger([...appenders, testAppender]);
	// Service Provider に書かれる処理の例 ここまで
	// Router ～ Controller らへんに書かれる処理 ここから
	await service.doSomething("/user/0001");
	// Router ～ Controller らへんに書かれる処理 ここまで

	// Assertion
	const expectRecord: ILogEvent = {
		level: LogLevel.INFO,
		message: "done something.",
		context: new Map([["path", "/user/0001"]]),
	};
	expect(testAppender.hasRecord(expectRecord)).toBe(true);
});
