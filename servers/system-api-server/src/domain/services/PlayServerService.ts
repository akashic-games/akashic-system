import * as restCommons from "@akashic/akashic-rest-commons";
import * as dt from "@akashic/server-engine-data-types";
import * as dataTypes from "@akashic/server-engine-data-types";

import * as activeRecord from "@akashic/akashic-active-record";
import { PlayManager } from "../../utils/PlayManager";
import ServerServiceMarkerInterface from "./ServerServiceMarkerInterface";

export default class PlayServerService implements ServerServiceMarkerInterface {
	protected readonly playManager: PlayManager;

	public constructor(playManager: PlayManager) {
		this.playManager = playManager;
	}

	/**
	 * 複数のPlay情報を取得する
	 *
	 * GET /v1.0/plays に対応する
	 * @param args play情報を取得するための引数
	 */
	public getPlays(args: GetPlaysRequest): Promise<dt.PagingResponse<dt.Play>> {
		const order = this.validateOrder(args.order);

		return Promise.all([
			this.playManager.findPlays(args.gameCode, args.status, args._offset, args._limit, order),
			args._count ? this.playManager.countPlays(args.gameCode, args.status) : undefined,
		]).then((tuple) => {
			return new dt.PagingResponse<dt.Play>({
				values: tuple[0],
				totalCount: tuple[1],
			});
		});
	}

	/**
	 * Playを作成する
	 *
	 * POST /v1.0/plays に対応する
	 *
	 * Errors
	 * * Invalid Parameter 作成情報にエラーがあるとき
	 * @param args 作成するPlayの情報
	 */
	public createPlay(args: CreatePlayRequest): Promise<dt.Play> {
		const gameCode: string | null = args.gameCode;
		const parentId: string | null = args.parent.playId;
		const parentData: string | null = args.parent.playData;
		const parentFrame: number | null = args.parent.frame;
		const parentIgnorableData: string | null = args.parent.ignorablePlayData;

		let createPlay: Promise<dt.Play>;
		if (gameCode && !parentId && !parentData) {
			createPlay = this.playManager.createNewPlay(gameCode);
		} else if (gameCode && parentData) {
			createPlay = this.playManager.createDerivedPlayByData(gameCode, parentData, parentFrame, parentIgnorableData);
		} else if (parentId) {
			createPlay = this.playManager.createDerivedPlayById(parentId, parentFrame);
		} else {
			createPlay = Promise.reject(new restCommons.Errors.InvalidParameter("invalid parameter."));
		}

		return createPlay;
	}

	/**
	 * Playの情報を取得する
	 *
	 * GET /v1.0/plays/:id に対応する
	 *
	 * Errors
	 * * NOT FOUND Play情報が見つからない時
	 * @param id 取得するPlayのplayId
	 */
	public getPlay(id: string): Promise<dt.Play> {
		return this.playManager.getPlay(id).then((result: dt.Play) => {
			if (!result) {
				throw new restCommons.Errors.NotFound("play not found");
			}
			return result;
		});
	}

	/**
	 * Playの情報を更新する
	 *
	 * PATCH /v1.0/plays/:id
	 *
	 * Errors
	 * * NOT FOUND Play情報が見つからない時
	 * @param id 更新するPlayのplayId
	 * @param args 更新する情報
	 */
	public patchPlay(id: string, args: PatchPlayRequest): Promise<dt.Play> {
		// もとのクライアントの形定義では `Promise<void>` になっているが、これは実装ミス（宣言ミス）。
		// 実際には、 `Promise<dt.Play>` が返却されている。

		return this.playManager.updatePlay(id, args.status);
	}

	/**
	 * Playを終了する
	 *
	 * DELETE /v1.0/plays/:id に対応する
	 *
	 * Errors
	 * * NOT FOUND Play情報が見つからない時
	 * * Conflict 終了済みやエラーとなったPlayを終了した場合
	 * @param id 終了するPlayのplayId
	 */
	public stopPlay(id: string): Promise<dt.Play> {
		// もとのクライアントの形定義では `Promise<void>` になっているが、これは実装ミス（宣言ミス）。
		// 実際には、 `Promise<dt.Play>` が返却されている。

		return this.playManager.updatePlay(id, dt.Constants.PLAY_STATE_SUSPENDING);
	}

	/**
	 * プレーの親子関係を作成する
	 *
	 * POST /v1.0/plays/:id/children に対応する
	 *
	 * Errors
	 * * NOT FOUND Play情報が見つからない時
	 * @param id 親となるプレーのID
	 * @param childId 子となるプレーのID
	 * @param allow 子プレーに強制付加するパーミッション
	 * @param deny 子プレーに強制削除するパーミッション
	 */
	public createPlayChildren(
		id: string,
		childId: string,
		allow?: dt.PlayTokenPermissionLike,
		deny?: dt.PlayTokenPermissionLike,
	): Promise<void> {
		return this.playManager
			.getPlay(id)
			.then((parent: dt.Play) => {
				if (!parent) {
					return Promise.reject(new restCommons.Errors.NotFound(`play not found. id:${id}`));
				}
			})
			.then(() => this.playManager.getPlay(childId))
			.then((child: dataTypes.Play) => {
				if (!child) {
					return Promise.reject(new restCommons.Errors.NotFound(`play not found. id:${child}`));
				}
			})
			.then(() => this.playManager.createPlayChildren(id, childId, allow, deny))
			.catch((error) => Promise.reject(error));
	}

	/**
	 * プレーの親子関係を削除する
	 *
	 * DELETE /v1.0/plays/:id/children/:childId に対応する
	 *
	 * @param id 親となるプレーのID
	 * @param childId 子となるプレーのID
	 */
	public deletePlayChildren(id: string, childId: string): Promise<void> {
		return this.playManager.deletePlayChildren(id, childId).catch((error) => Promise.reject(error));
	}

	/**
	 * ニコ生の番組種別を保存する
	 * @param playId
	 * @param providerType
	 * @returns
	 */
	public addPlaysNicoliveMetadata(playId: string, providerType: string): Promise<void> {
		return this.playManager.addPlaysNicoliveMetadata(playId, providerType);
	}

	private validateOrder(order?: string): activeRecord.RecordOrder {
		if (order) {
			switch (order) {
				case "a":
				case "asc":
					return activeRecord.OrderAsc;
				case "d":
				case "desc":
					return activeRecord.OrderDesc;
				default:
					throw new Error("orderの値が不正です。 asc または descを指定してください");
			}
		} else {
			return undefined;
		}
	}
}

// export されていなかったインターフェース
export interface PagingRequest {
	_offset?: number;
	_limit?: number;
	_count?: number;
}

export interface GetItemRequest {
	id: string;
}

export interface CreateInstanceRequest {
	gameCode: string;
	entryPoint: string;
	cost: number;
	modules: dt.InstanceModuleLike[];
}

export interface PatchInstanceRequest {
	status: string;
	exitCode?: string;
}

export interface FindInstancesRequest extends PagingRequest {
	gameCode?: string;
	status?: string[];
	entryPoint?: string;
	videoPublishUri?: string;
	processName?: string;
}

export interface ValidateTokenRequest {
	playId: string;
	value: string;
}

export interface GetPlaysRequest extends PagingRequest {
	gameCode?: string;
	status?: string[];
	order?: string;
}

export interface CreatePlayRequest {
	gameCode?: string;
	parent?: {
		playId?: string;
		playData?: string;
		frame?: number;
		ignorable?: boolean;
		ignorablePlayData?: string;
	};
}

export interface PatchPlayRequest {
	status: string;
}

export interface CreatePlaylogEventRequest {
	type: string;
	values: any;
}

export interface CopyPlaylogRequest {
	playId?: string;
	playData?: string;
	count?: number;
	ignorablePlayData?: string;
}

export interface GetReportsRequest extends PagingRequest {
	_sort?: string;
	condition?: string;
	since?: Date;
	until?: Date;
}

export interface RegisteredGameInfo {
	width: number;
	height: number;
	fps: number;
}
