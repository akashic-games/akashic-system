import { IncomingWebhook, IncomingWebhookDefaultArguments, IncomingWebhookSendArguments } from "@slack/webhook";
import { IAppender } from "./Appender";
import { NullAppender } from "./NullAppender";
import { LogLevel } from "./LogLevel";
import { contextToJSONString, ILogEvent } from "./LogEvent";

export class SlackAppender implements IAppender {
	private static buildMessage(message: string): IncomingWebhookSendArguments {
		// color を使いたかったけれど、attachment にする必要があるらしく、block では使えないので、諦めた。
		// see https://api.slack.com/messaging/attachments-to-blocks#direct_equivalents
		return {
			blocks: [{ type: "context", elements: [{ type: "plain_text", text: message }] }],
		};
	}

	/**
	 * もし Slack の API サーバが落ちてるなどした場合に、ここへフォールバックする。
	 *
	 * できるだけ 10ms 以下で出力できるような Appender にすること。
	 * 遅くとも 100 ms にすること。
	 * ほとんどの場合、Console（== stdout/stderr）への出力でしょうから、大丈夫だと思う。
	 */
	public fallbackAppender: IAppender = new NullAppender();

	private client: IncomingWebhook;

	/**
	 * @param url Slack API のエンドポイント
	 * @param defaultArguments Slack へ send するときのデフォルトの設定。アイコンとか。
	 */
	public static create(url?: string, defaultArguments?: IncomingWebhookDefaultArguments): IAppender {
		if (!url) {
			// url パラメーターのデフォルト値を無くしたが、既存のコードを壊したくないので何もしない Appender を返す
			return new NullAppender();
		}
		return new SlackAppender(new IncomingWebhook(url, defaultArguments));
	}

	constructor(client: IncomingWebhook) {
		this.client = client;
	}

	/**
	 * @inheritDoc
	 */
	public async append(event: ILogEvent): Promise<boolean> {
		const contextString: string = contextToJSONString(event.context);
		const message = SlackAppender.buildMessage(`${event.level}: ${event.message} context:(${contextString}) marker:(${event.marker})`);

		// info 以下は無視
		// LogLevel は 0 に近いほど緊急度が高い
		if (event.level >= LogLevel.INFO) {
			return false;
		}

		try {
			await this.client.send(message);

			return true;
		} catch (e) {
			// 本来 Slack へ送信するはずだったメッセージ
			await this.fallbackAppender.append(event);
			// send 自体のエラー
			await this.fallbackAppender.append({
				message: e?.toString() ?? String(e),
				level: LogLevel.ERROR,
				context: new Map(),
			});

			return false;
		}

		// never here
	}
}
