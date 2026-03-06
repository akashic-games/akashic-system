import * as CastUtil from "@akashic/cast-util";
import * as dt from "@akashic/server-engine-data-types";

import * as ActiveRecord from "@akashic/akashic-active-record";
import * as RestCommons from "@akashic/akashic-rest-commons";

import * as ElasticSearchConfig from "../../utils/ElasticSearchConfig";
import * as ElasticSearcher from "../../utils/ElasticSearcher";
import { InstanceManager } from "../../utils/InstanceManager";
import ServerServiceMarkerInterface from "./ServerServiceMarkerInterface";

/**
 * インスタンスモデルのモジュール解析器
 */
namespace InstanceModuleParser {
	export function parsePlaylogWorker(mod: dt.InstanceModuleLike): PlaylogWorkerParameter {
		const result: PlaylogWorkerParameter = {};
		if (!mod.values) {
			return result;
		}

		if (mod.code === "staticPlaylogWorker" && mod.values.playlog) {
			try {
				result.playId = CastUtil.bigint(mod.values.playlog.playId, true);
			} catch (error) {
				// 異常判定は外部にて行う:
				result.playId = undefined;
			}
		}
		if (mod.code === "dynamicPlaylogWorker") {
			try {
				result.playId = CastUtil.bigint(mod.values.playId, true);
			} catch (error) {
				// 異常判定は外部にて行う:
				result.playId = undefined;
			}
		}
		return result;
	}

	export function parseVideoPublisher(mod: dt.InstanceModuleLike): VideoPublisherParameter {
		const result: VideoPublisherParameter = {};
		if (!mod.values) {
			return result;
		}

		if (mod.code === "videoPublisher") {
			try {
				result.videoPublishUri = CastUtil.string(mod.values.videoPublishUri, 512, true);
				result.videoFrameRate = CastUtil.int(mod.values.videoFrameRate, true);
			} catch (error) {
				// 異常判定は外部にて行う:
				result.videoPublishUri = undefined;
				result.videoFrameRate = undefined;
			}
		}
		return result;
	}

	/**
	 * イベントハンドラの解析
	 */
	export function parseEventHandler(mod: dt.InstanceModuleLike): dt.EventHandler[] {
		let result: dt.EventHandler[];
		if (!mod.values) {
			return result;
		}

		if (mod.code === "eventHandlers") {
			const handlers: any[] = mod.values.handlers;
			try {
				result = handlers.map((value) => dt.EventHandler.fromObject(value));
			} catch (error) {
				result = undefined;
			}
		}
		return result;
	}

	export function validatePlaylogWorker(parameter: PlaylogWorkerParameter): boolean {
		return parameter && parameter.playId != null;
	}

	export function validateVideoPublisher(parameter: VideoPublisherParameter): boolean {
		return parameter && parameter.videoPublishUri != null && parameter.videoFrameRate != null;
	}

	export function validateEventHandler(parameter: dt.EventHandlerLike[]): boolean {
		return parameter && Array.isArray(parameter);
	}
}

export default class InstanceServerService implements ServerServiceMarkerInterface {
	private database: ActiveRecord.Database;
	private instanceManager: InstanceManager;
	private elasticSearcher: ElasticSearcher.ElasticSearcher;

	constructor(
		database: ActiveRecord.Database,
		instanceManager: InstanceManager,
		elasticSearchConf: ElasticSearchConfig.ElasticSearchConfig,
	) {
		this.database = database;
		this.instanceManager = instanceManager;
		this.elasticSearcher = new ElasticSearcher.ElasticSearcher(elasticSearchConf);
	}

	// /v1.0/instances
	/**
	 * インスタンスを検索する
	 *
	 * GET /v1.0/instances
	 */
	public findInstances(args: FindInstancesRequest): Promise<dt.PagingResponseLike<dt.Instance>> {
		return Promise.all([
			this.database.repositories.instance.findInstance(
				args.gameCode,
				args.status,
				args.processName,
				args.entryPoint,
				args.videoPublishUri,
				args._offset,
				args._limit,
			),
			args._count
				? this.database.repositories.instance.count(
						args.gameCode,
						args.status,
						args.processName,
						args.entryPoint,
						args.videoPublishUri,
						args._offset,
						args._limit,
					)
				: undefined,
		])
			.then(
				(result: { 0: dt.Instance[]; 1?: string }) =>
					new dt.PagingResponse({
						values: result[0],
						totalCount: result[1],
					}),
			)
			.catch((error: any) => Promise.reject(error));
	}

	/**
	 * akashic-cluster-master経由でインスタンスを作成する
	 *
	 * POST /v1.0/instances
	 */
	public createInstance(args: CreateInstanceRequest): Promise<dt.Instance> {
		// モジュールのうちRDBで検索キーとするものを抽出:
		let playlogWorkerParameter: PlaylogWorkerParameter;
		let videoPublisherParameter: VideoPublisherParameter;
		let eventHandlerParameter: dt.EventHandler[];

		for (const module of args.modules) {
			if (!InstanceModuleParser.validatePlaylogWorker(playlogWorkerParameter)) {
				playlogWorkerParameter = InstanceModuleParser.parsePlaylogWorker(module);
			}
			if (!InstanceModuleParser.validateVideoPublisher(videoPublisherParameter)) {
				videoPublisherParameter = InstanceModuleParser.parseVideoPublisher(module);
			}
			if (!InstanceModuleParser.validateEventHandler(eventHandlerParameter)) {
				eventHandlerParameter = InstanceModuleParser.parseEventHandler(module);
			}

			// 複数のモジュールが存在する場合は最初の一つのみ適用:
			if (
				InstanceModuleParser.validatePlaylogWorker(playlogWorkerParameter) &&
				InstanceModuleParser.validateVideoPublisher(videoPublisherParameter) &&
				InstanceModuleParser.validateEventHandler(eventHandlerParameter)
			) {
				break;
			}
		}

		let videoSetting: { videoPublishUri: string; videoFrameRate: number };
		if (InstanceModuleParser.validateVideoPublisher(videoPublisherParameter)) {
			videoSetting = {
				videoPublishUri: videoPublisherParameter.videoPublishUri,
				videoFrameRate: videoPublisherParameter.videoFrameRate,
			};
		} else {
			videoSetting = undefined;
		}

		// イベントハンドラが存在した場合、インスタンス作成前にtypeが正しいか確認しておく
		if (eventHandlerParameter && eventHandlerParameter.length > 0) {
			const events = [
				dt.Constants.EVENT_HANDLER_TYPE_INSTANCE_STATUS,
				dt.Constants.EVENT_HANDLER_TYPE_ERROR,
				dt.Constants.EVENT_HANDLER_TYPE_GAME_EVENT,
			];
			const typeList = eventHandlerParameter.map((value) => value.type);
			const typeCheck = typeList.every((type) => {
				return events.indexOf(type) >= 0;
			});

			if (!typeCheck) {
				Promise.reject(new RestCommons.Errors.InvalidParameter("invalid instance event handler types [" + typeList.join(",") + "]"));
			}
		}

		return this.instanceManager.createAndStartInstance({
			playId: playlogWorkerParameter ? playlogWorkerParameter.playId : undefined,
			gameCode: args.gameCode,
			entryPoint: args.entryPoint || "",
			cost: args.cost,
			modules: args.modules,
			videoSetting,
			eventHandlers: eventHandlerParameter,
			assignmentConstraints: args.assignmentConstraints,
			forceAssignTo: args.forceAssignTo,
		});
	}

	// /v1.0/instances/:instanceId
	/**
	 * akashic-cluster-master経由でインスタンスを停止する
	 *
	 * DELETE /v1.0/instances/:instanceId に対応する
	 */
	public deletetInstance(instanceId: string): Promise<dt.InstanceLike> {
		return this.instanceManager.stopInstance(instanceId);
	}

	/**
	 * インスタンス情報を取得する
	 *
	 * GET /v1.0/instances/:instanceId に対応する
	 */
	public getInstance(instanceId: string): Promise<dt.Instance> {
		return this.database.repositories.instance
			.get(instanceId)
			.then((instance: dt.Instance) => {
				if (!instance) {
					throw new RestCommons.Errors.NotFound("instance not found");
				}
				return instance;
			})
			.catch((err: any) => Promise.reject(err));
	}

	/**
	 * インスタンスを一時停止する
	 *
	 * PATCH /v1.0/instances/:instanceId (status = "paused" or "pausing") に対応する
	 *
	 */
	public pauseInstance(instanceId: string): Promise<dt.Instance> {
		return this.instanceManager.pauseInstance(instanceId);
	}

	/**
	 * インスタンスを一時停止を解除する
	 *
	 * PATCH /v1.0/instances/:instanceId (status = "running" or "resuming") に対応する
	 *
	 */
	public resumeInstance(instanceId: string): Promise<dt.Instance> {
		return this.instanceManager.resumeInstance(instanceId);
	}

	// /v1.0/plays/:playId/:instances
	/**
	 * 複数のインスタンス情報を取得する
	 *
	 * GET /v1.0/plays/:playId/instances に対応する
	 */
	public getInstancesByPlayId(playId: string): Promise<dt.PagingResponseLike<dt.Instance>> {
		return this.database.repositories.playsInstances
			.getByPlayId(playId)
			.then((instances: dt.Instance[]) => new dt.PagingResponse({ values: instances }))
			.catch((err: any) => Promise.reject(err));
	}

	// video  setting
	/**
	 * 複数の映像出力情報を取得する。
	 * 主にSystemAPIからgamesレスポンスを結合して返す用
	 *
	 * GET /v1.0/videoSettings に対応する。
	 */
	public getVideoSettings(): Promise<never> {
		return Promise.reject(new RestCommons.Errors.NotImplemented(""));
	}

	/**
	 * 映像出力情報を取得する
	 *
	 * GET /v1.0/instances/:instanceId/videoSetting に対応する
	 */
	public getVideoSetting(): Promise<never> {
		return Promise.reject(new RestCommons.Errors.NotImplemented(""));
	}

	// reports
	/**
	 * レポート取得
	 *
	 * GET /v1.0/reports に対応する
	 *
	 * Errors
	 * * Invalid Parameter リクエストに間違いがある
	 */
	public getReports(args: GetReportsRequest): Promise<dt.PagingResponse<any>> {
		const defaultLimit = 10;
		const maxLimit = 100;

		const range: { since?: Date; until?: Date } = {};
		let conditions: { [key: string]: string };

		try {
			if (args.since || args.until) {
				range.since = CastUtil.date(args.since, true, "invalid since");
				range.until = CastUtil.date(args.until, true, "invalid until");
			}
			if (typeof args._limit === "number") {
				if (args._limit > maxLimit) {
					args._limit = maxLimit;
				}
			} else {
				args._limit = defaultLimit;
			}
			if (args.condition) {
				conditions = JSON.parse(args.condition);
			}
		} catch (error) {
			return Promise.reject(new RestCommons.Errors.InvalidParameter("invalid parameter", error));
		}

		return this.elasticSearcher
			.findReports({ from: args._offset, size: args._limit, conditions, range })
			.then(
				(result: ElasticSearcher.ElasticSearcherResponse) =>
					new dt.PagingResponse({
						values: result.hits,
						totalCount: String(result.total),
					}),
			)
			.catch((error: any) => Promise.reject(new RestCommons.Errors.InternalServerError("search error:", error)));
	}
}

// ここから下は、 data types
// Request / Response で使われる Entity
export interface PagingRequest {
	_offset?: number;
	_limit?: number;
	_count?: number;
}

export interface GetItemRequest {
	/**
	 * 取得する対象のID
	 */
	id: string;
}

export interface CreateInstanceRequest {
	/**
	 * 作成するインスタンスで動かすゲームの識別子
	 */
	gameCode: string;
	/**
	 * 作成するインスタンスで動かすゲームのリビジョン
	 */
	gameRevision?: string;
	/**
	 * 実行する js ファイルのパス
	 */
	entryPoint?: string;
	/**
	 * 作成するインスタンスで動かすゲームの実行コスト
	 */
	cost: number;
	/**
	 * 作成するインスタンスに入れる各種モジュール
	 */
	modules: dt.InstanceModuleLike[];
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

export interface PatchInstanceRequest {
	/**
	 * 指定したstatusに更新する
	 */
	status: string;
	/**
	 * 指定したexitCodeに更新する
	 */
	exitCode?: string;
}

export interface FindInstancesRequest extends PagingRequest {
	/**
	 * 検索対象ゲームコード
	 */
	gameCode?: string;
	/**
	 * 検索対象のインスタンス状態
	 */
	status?: string[];
	/**
	 * 検索対象の実行ファイルパス名
	 */
	entryPoint?: string;
	/**
	 * 検索対象のビデオ出力先
	 */
	videoPublishUri?: string;
	/**
	 * 検索対象の実行プロセス識別子
	 */
	processName?: string;
}

export interface ValidateTokenRequest {
	/**
	 * 検証対象のplayId
	 */
	playId: string;
	/**
	 * 検証対象のトークン文字列
	 */
	value: string;
}

export interface GetPlaysRequest extends PagingRequest {
	/**
	 * 取得対象のgameId
	 */
	gameCode?: string;
	/**
	 * 取得対象のstatus一覧
	 */
	status?: string[];
	/**
	 * 取得する際の並び順
	 */
	order?: string;
}

export interface CreatePlayRequest {
	/**
	 * ゲームコード
	 * 新規プレー作成か、プレーデータ指定の派生プレー作成時に必須
	 */
	gameCode?: string;
	/**
	 * 派生プレー作成時の親プレー情報
	 */
	parent?: {
		/**
		 * プレー ID 指定
		 */
		playId?: string;
		/**
		 * プレーログデータ直接指定
		 */
		playData?: string;
		/**
		 * コピーするプレーログの最終フレーム番号 (指定のない場合は全てのプレーログをコピー)
		 */
		frame?: number;
	};
}

export interface PatchPlayRequest {
	/**
	 * 指定したstatusに更新する
	 */
	status: string;
}

export interface CreatePlaylogEventRequest {
	/**
	 * イベントの種別
	 */
	type: string;
	/**
	 * イベント種別に応じた値
	 */
	values: any;
}

export interface CopyPlaylogRequest {
	/**
	 * 既存 play からコピーする場合のコピー元 playId
	 */
	playId?: string;
	/**
	 * データを直接指定する場合のデータ
	 */
	playData?: string;
	/**
	 * コピーするフレーム数 (指定のない場合は全てコピー)
	 */
	count?: number;
}

export interface GetReportsRequest extends PagingRequest {
	/**
	 * ソート指定
	 */
	_sort?: string;
	/**
	 * 条件フィルタ
	 */
	condition?: string;
	/**
	 * 日時フィルタ（自）
	 */
	since?: Date;
	/**
	 * 日時フィルタ（至）
	 */
	until?: Date;
}

/**
 * zip登録時に返却される情報
 */
export interface RegisteredGameInfo {
	/**
	 * このゲームの幅
	 */
	width: number;
	/**
	 * このゲームの高さ
	 */
	height: number;
	/**
	 * このゲームのFPS
	 */
	fps: number;
}

// ここから下は、instance module parser
export interface PlaylogWorkerParameter {
	playId?: string;
}

export interface VideoPublisherParameter {
	videoPublishUri?: string;
	videoFrameRate?: number;
}
