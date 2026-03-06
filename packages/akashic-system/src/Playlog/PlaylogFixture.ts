import type { IPlaylogPublisher } from "./PlaylogQueue/IPlaylogPublisher";
import type { IPlaylogQueueStatusDatabase } from "./IPlaylogQueueStatusDatabase";

/**
 * publish操作のための準備や型付け操作処理まとめ
 */
export class PlaylogFixture {
	private publisher: IPlaylogPublisher;
	private database: IPlaylogQueueStatusDatabase;

	constructor(publisher: IPlaylogPublisher, database: IPlaylogQueueStatusDatabase) {
		this.publisher = publisher;
		this.database = database;
	}
	/**
	 * playlogのpublishを開始するための処置
	 * 冪等性あり。
	 */
	async preparePublishPlaylog(playId: string): Promise<void> {
		// exchangeとキューを作成する
		await this.publisher.prepare(playId);
		// databaseに該当プレイが書き込み中と保存する
		await this.database.setPlaying(playId);
	}
	/**
	 * playlogのpublishを停止するための処理
	 * 冪等性あり。
	 */
	async cleanupPublishPlaylog(playId: string): Promise<void> {
		// exchangeとキューを消す(保存用キューはplaylog-store-workerが消す)
		await this.publisher.cleanup(playId);
		// databaseに該当プレイが新規書き込み終了と書き込む
		await this.database.setClosing(playId);
	}
}
