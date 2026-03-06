import restClientCore = require("@akashic/rest-client-core");
import BaseApiClient = require("./BaseApiClient");
import methodConfig = require("./config/methods");
import requests = require("./DataTypes");

/**
 * PlayLog api Serverにリクエストを投げるクライアント
 */
class PlayLogEventClient extends BaseApiClient {
	private createEventMethod: restClientCore.Method<void>;
	private getPlaylogMethod: restClientCore.Method<string>;
	private copyPlaylogMethod: restClientCore.Method<void>;
	private putStartPointMethod: restClientCore.Method<void>;
	private putTickMethod: restClientCore.Method<void>;

	/**
	 * @param baseUrl Playlog api Serverの基底URL
	 */
	constructor(baseUrl: string) {
		super(baseUrl);
		const methods = methodConfig.playLogEvent;
		this.createEventMethod = this.getMethod(methods.createEvent, (data) => data);
		this.getPlaylogMethod = this.getMethod(methods.getPlaylog, (data) => data);
		this.copyPlaylogMethod = this.getMethod(methods.copyPlaylog, (data) => data);
		this.putStartPointMethod = this.getMethod(methods.putStartPoint, (data) => data);
		this.putTickMethod = this.getMethod(methods.putTick, (data) => data);
	}

	/**
	 * プレーイベントの通知
	 *
	 * POST /v1.0/plays/:id/events に対応する
	 *
	 * Errors
	 * * Invalid Parameter 作成情報にエラーがあるとき
	 * @param id 通知イベントと関連するプレーID
	 * @param args
	 */
	public createEvent(id: string, args: requests.CreatePlaylogEventRequest) {
		return this.createEventMethod.exec({ id }, args);
	}
	/**
	 * プレーログの取得
	 *
	 * GET /v1.0/plays/:id/playlog に対応する
	 *
	 * @param id プレーログを取得するプレー ID
	 */
	public getPlaylog(id: string) {
		return this.getPlaylogMethod.exec({ id });
	}
	/**
	 * プレーログのコピー
	 *
	 * GET /v1.0/plays/:id/playlog に対応する
	 *
	 * @param id コピー先プレー ID
	 * @param args コピー元情報
	 */
	public copyPlaylog(id: string, args: requests.CopyPlaylogRequest) {
		return this.copyPlaylogMethod.exec({ id }, args);
	}
	/**
	 * start point データの送信
	 *
	 * POST /v1.0/plays/:id/startpoints に対応する
	 *
	 * @param id 対象プレー ID
	 * @param startPoint AMFlow start point データ
	 */
	public putStartPoint(id: string, startPoint: any) {
		return this.putStartPointMethod.exec({ id }, { startPoint });
	}
	/**
	 * プレーログ tick データの送信
	 *
	 * POST /v1.0/plays/:id/ticks に対応する
	 *
	 * @param id 対象プレー ID
	 * @param tick プレーログ tick データ
	 */
	public putTick(id: string, tick: any[]) {
		return this.putTickMethod.exec({ id }, { tick });
	}
}
export = PlayLogEventClient;
