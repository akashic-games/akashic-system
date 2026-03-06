export type ApplicationStatus = "created" | "initializing" | "initialized" | "booting" | "running" | "finalizing" | "terminated";

/**
 * ```puml
 * @startuml
 * [*] -> created : new Application()
 * created --> initializing : initialize()
 * initializing -> initialized
 * initialized --> booting : boot()
 * booting -> running
 * running --> finalizing : terminate()
 * finalizing -> terminated
 * terminated -> booting: boot()
 * terminated -> [*]
 * @enduml
 * ```
 */
export interface IApplication {
	readonly status: ApplicationStatus;

	/**
	 * - 設定ファイルから設定を読み込む
	 */
	initialize(): Promise<IApplication>;

	/**
	 * - ミドルウェアへのコネクションやコネクションプールの生成
	 * - process へのイベントリスナーの登録
	 * - `listen()`
	 */
	boot(): Promise<IApplication>;

	/**
	 * プロセスを終了する。
	 */
	terminate(): Promise<IApplication>;
}
