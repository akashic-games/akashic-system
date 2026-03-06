import { ILogEvent } from "./LogEvent";

/**
 * Logger から受け取った Log Event をバックエンドへ出力処理をするクラスのインターフェース
 */
export interface IAppender {
	/**
	 * ログをバックエンドへ出力する。
	 * @returns 正常に出力できた場合 True。バックエンドに出力しなかったり、失敗した場合は False。
	 */
	append(event: ILogEvent): Promise<boolean>;
}
