import * as activeRecord from "@akashic/akashic-active-record";
import * as RestCommons from "@akashic/akashic-rest-commons";
import { InstanceRequestPublisher } from "@akashic/instance-requester";
import * as dt from "@akashic/server-engine-data-types";
import { Connection } from "@akashic/tapper";

/**
 * インスタンス作成に必要な情報の一覧
 */
export interface CreateInstanceArgs {
	/**
	 * 起動するゲームのコード
	 */
	gameCode: string;
	/**
	 * プレーログの源泉プレーID
	 * 直接プレーログを入力する場合は存在しない
	 */
	playId?: string;
	/**
	 * 起動するスクリプトのパス
	 */
	entryPoint: string;
	/**
	 * 割り当て計算で使用する起動するゲームのコスト情報
	 */
	cost: number;
	/**
	 * 割り当て時に実行側に渡されるモジュール情報
	 */
	modules: dt.InstanceModuleLike[];
	/**
	 * 起動するゲームの動画出力情報
	 * 出力しない場合は存在しない
	 */
	videoSetting?: {
		videoPublishUri: string;
		videoFrameRate: number;
	};
	/**
	 * インスタンスイベントハンドラ
	 */
	eventHandlers?: dt.EventHandler[];
	/**
	 * インスタンス割り当て先制約
	 */
	assignmentConstraints?: {
		/** 割り当て先プロセスの trait */
		trait: string[];
	};
	/**
	 * インスタンス割り当て先の強制指定 (デバッグ、動作確認用)
	 */
	forceAssignTo?: {
		/** 割り当て先ホスト名 */
		host: string;
		/** 割り当て先プロセス名 */
		name: string;
	};
}

/**
 * ゲーム起動のためのインスタンスの作成を行う
 */
export class InstanceManager {
	private _database: activeRecord.Database;
	private _instanceRequestPublisher: InstanceRequestPublisher;

	constructor(database: activeRecord.Database, instanceRequestPublisher: InstanceRequestPublisher) {
		this._database = database;
		this._instanceRequestPublisher = instanceRequestPublisher;
	}

	/**
	 * prepare状態のインスタンスの作成までを行う
	 */
	public createPrepareInstance(args: CreateInstanceArgs): Promise<dt.Instance> {
		return this._database.transaction<dt.Instance>(async (connection: Connection) => {
			const instance = await this._database.repositories.instance.save(
				new dt.Instance({
					gameCode: args.gameCode,
					entryPoint: args.entryPoint,
					cost: args.cost,
					status: dt.Constants.INSTANCE_STATE_PREPARE, // 最初は起動準備状態
					region: "akashicCluster",
					modules: args.modules,
				}),
				connection,
			);
			if (args.playId) {
				// プレーとインスタンスの関連登録
				await this._database.repositories.playsInstances.save(args.playId, instance.id, connection);
			}
			if (args.videoSetting) {
				// videoSettingを作成して保存する
				await this._database.repositories.videoSetting.save(
					new dt.VideoSetting({
						instanceId: instance.id,
						videoPublishUri: args.videoSetting.videoPublishUri,
						videoFrameRate: args.videoSetting.videoFrameRate,
					}),
					connection,
				);
			}
			if (args.eventHandlers) {
				// イベントハンドラを登録
				args.eventHandlers.forEach(async (handler) => {
					await this._database.repositories.instanceEventHandler.save(handler, instance.id, connection);
				});
			}
			return instance;
		});
	}

	/**
	 * インスタンスを作成し、開始する
	 */
	public async createAndStartInstance(args: CreateInstanceArgs): Promise<dt.Instance> {
		const instance = await this.createPrepareInstance(args);
		await this._instanceRequestPublisher.requestStartInstance(instance.id, {
			assignmentConstraints: args.assignmentConstraints,
			forceAssignTo: args.forceAssignTo,
		});
		return instance;
	}

	/**
	 * インスタンスを停止する
	 */
	public async stopInstance(instanceId: string): Promise<dt.Instance> {
		const instance = await this._database.transaction<dt.Instance>(async (connection: Connection) => {
			const target = await this._database.repositories.instance.getWithLock(instanceId, connection);
			if (!target) {
				return Promise.reject(new RestCommons.Errors.NotFound("instance not found"));
			}
			if (target.status === dt.Constants.INSTANCE_STATE_CLOSING || target.status === dt.Constants.INSTANCE_STATE_CLOSED) {
				return Promise.reject(new RestCommons.Errors.Conflict("instance state conflict"));
			}
			return this._database.repositories.instance.updateStatus(
				target.id,
				dt.Constants.INSTANCE_STATE_CLOSING,
				undefined,
				undefined,
				connection,
			);
		});
		await this._instanceRequestPublisher.requestStopInstance(instance.id);
		return instance;
	}

	/**
	 * インスタンスを一時停止する
	 */
	public async pauseInstance(instanceId: string): Promise<dt.Instance> {
		const instance = await this._database.transaction<dt.Instance>(async (connection: Connection) => {
			const target = await this._database.repositories.instance.getWithLock(instanceId, connection);
			if (!target) {
				return Promise.reject(new RestCommons.Errors.NotFound("instance not found"));
			}
			if (target.status !== dt.Constants.INSTANCE_STATE_RUNNING) {
				return Promise.reject(new RestCommons.Errors.Conflict("instance state conflict"));
			}
			return this._database.repositories.instance.updateStatus(
				target.id,
				dt.Constants.INSTANCE_STATE_PAUSING,
				undefined,
				undefined,
				connection,
			);
		});
		await this._instanceRequestPublisher.requestPauseInstance(instance.id);
		return instance;
	}

	/**
	 * インスタンスの一時停止を解除する
	 */
	public async resumeInstance(instanceId: string): Promise<dt.Instance> {
		const instance = await this._database.transaction<dt.Instance>(async (connection: Connection) => {
			const target = await this._database.repositories.instance.getWithLock(instanceId, connection);
			if (!target) {
				return Promise.reject(new RestCommons.Errors.NotFound("instance not found"));
			}
			if (target.status !== dt.Constants.INSTANCE_STATE_PAUSED) {
				return Promise.reject(new RestCommons.Errors.Conflict("instance state conflict"));
			}
			return this._database.repositories.instance.updateStatus(
				target.id,
				dt.Constants.INSTANCE_STATE_RESUMING,
				undefined,
				undefined,
				connection,
			);
		});
		await this._instanceRequestPublisher.requestResumeInstance(instance.id);
		return instance;
	}
}
