import * as activeRecord from "@akashic/akashic-active-record";
import * as restCommons from "@akashic/akashic-rest-commons";
import { context, LoggerAware } from "@akashic-system/logger";
import { RedisCommander } from "ioredis";
import type { PlaylogFixture } from "@akashic/akashic-system";

import * as dataTypes from "@akashic/server-engine-data-types";
import * as tapper from "@akashic/tapper";

import PlaylogApiServerService from "../domain/services/PlaylogApiServerService";

export class PlayManager extends LoggerAware {
	private _database: activeRecord.Database;
	private _playlogApiClient: PlaylogApiServerService;
	private _redisRepository: RedisCommander;
	private playlogFixture: PlaylogFixture;

	constructor(
		database: activeRecord.Database,
		playlogFixture: PlaylogFixture,
		playlogApiClient: PlaylogApiServerService,
		redis: RedisCommander,
	) {
		super();
		this._database = database;
		this._playlogApiClient = playlogApiClient;
		this._redisRepository = redis;
		this.playlogFixture = playlogFixture;
	}

	public getPlay(id: string): Promise<dataTypes.Play> {
		return this._database.repositories.play.get(id);
	}

	public findPlays(
		gameCode?: string,
		status?: string[],
		offset?: number,
		limit?: number,
		order?: activeRecord.RecordOrder,
	): Promise<dataTypes.Play[]> {
		return this._database.repositories.play.find(gameCode, status, offset, limit, order);
	}

	public countPlays(gameCode?: string, status?: string[]): Promise<string> {
		return this._database.repositories.play.count(gameCode, status);
	}

	public createNewPlay(gameCode: string): Promise<dataTypes.Play> {
		return this._database.repositories.play
			.save(
				new dataTypes.Play({
					gameCode,
					started: new Date(),
					status: dataTypes.Constants.PLAY_STATE_SUSPENDING,
				}),
			)
			.then((play) => this._startPlay(play));
	}

	public createDerivedPlayById(parentId: string, frame?: number): Promise<dataTypes.Play> {
		return (
			this.getPlay(parentId)
				.then((result: dataTypes.Play) =>
					result ? result : Promise.reject<dataTypes.Play>(new restCommons.Errors.NotFound("play not found")),
				)
				.then((parent: dataTypes.Play) => {
					if (parent.status !== dataTypes.Constants.PLAY_STATE_RUNNING && parent.status !== dataTypes.Constants.PLAY_STATE_SUSPENDING) {
						return Promise.reject<dataTypes.Play>(new restCommons.Errors.Conflict('parent play status is "' + parent.status + '"'));
					}
					return parent;
				})
				.then((parent: dataTypes.Play) => {
					// preparing 状態でプレー作成
					return this._database.repositories.play.save(
						new dataTypes.Play({
							gameCode: parent.gameCode,
							parentId: parent.id,
							started: new Date(),
							status: dataTypes.Constants.PLAY_STATE_PREPARING,
						}),
					);
				})
				.then((play: dataTypes.Play) => {
					const copyCount: number = typeof frame === "number" ? frame + 1 : null;
					return this._playlogApiClient
						.copyPlaylog(play.id, { playId: parentId, count: copyCount })
						.catch((err) => {
							// playlog コピー失敗したら broken 状態にする
							return this._updateStatus(play, dataTypes.Constants.PLAY_STATE_BROKEN)
								.catch(() => {
									// 例外処理中のエラーは無視 (ロギングのみ)
									this.logger.warn('can\'t change state to "broken"', context({ playId: play.id }));
								})
								.then(() => Promise.reject(err));
						})
						.then(() => play);
				})
				// playlog コピー成功したら suspending 状態にする
				.then((play: dataTypes.Play) => this._updateStatus(play, dataTypes.Constants.PLAY_STATE_SUSPENDING))
				.then((play: dataTypes.Play) => this._startPlay(play))
		);
	}

	public createDerivedPlayByData(gameCode: string, playData: string, frame?: number, ignorablePlayData?: string): Promise<dataTypes.Play> {
		// preparing 状態でプレー作成
		return (
			this._database.repositories.play
				.save(
					new dataTypes.Play({
						gameCode,
						started: new Date(),
						status: dataTypes.Constants.PLAY_STATE_PREPARING,
					}),
				)
				.then((play: dataTypes.Play) => {
					const copyCount: number = typeof frame === "number" ? frame + 1 : null;
					return this._playlogApiClient
						.copyPlaylog(play.id, { playData, count: copyCount, ignorablePlayData })
						.catch((err) => {
							// playlog コピー失敗したら broken 状態にする
							return this._updateStatus(play, dataTypes.Constants.PLAY_STATE_BROKEN)
								.catch(() => {
									// 例外処理中のエラーは無視 (ロギングのみ)
									this.logger.warn('can\'t change state to "broken"', context({ playId: play.id }));
								})
								.then(() => Promise.reject(err));
						})
						.then(() => play);
				})
				// playlog コピー成功したら suspending 状態にする
				.then((play: dataTypes.Play) => this._updateStatus(play, dataTypes.Constants.PLAY_STATE_SUSPENDING))
				.then((play: dataTypes.Play) => this._startPlay(play))
		);
	}

	public updatePlay(id: string, state: string): Promise<dataTypes.Play> {
		if (state !== dataTypes.Constants.PLAY_STATE_RUNNING && state !== dataTypes.Constants.PLAY_STATE_SUSPENDING) {
			return Promise.reject(new restCommons.Errors.InvalidParameter("invalid status parameter"));
		}
		return this._database.transaction((connection) => {
			return this._database.repositories.play
				.getWithLock(id, connection)
				.then((result: dataTypes.Play) =>
					result ? result : Promise.reject<dataTypes.Play>(new restCommons.Errors.NotFound("play not found")),
				)
				.then((play: dataTypes.Play) => this._checkStatus(play, state))
				.then((play: dataTypes.Play) => {
					if (state === dataTypes.Constants.PLAY_STATE_RUNNING) {
						return this._startPlay(play, connection);
					} else {
						return this._stopPlay(play, connection);
					}
				});
		});
	}

	public createPlayChildren(
		playId: string,
		childId: string,
		allow: dataTypes.PlayTokenPermissionLike,
		deny: dataTypes.PlayTokenPermissionLike,
	): Promise<void> {
		return this._redisRepository
			.hset(`akashic:parent_plays:${childId}`, playId, JSON.stringify({ allow: allow ? allow : undefined, deny: deny ? deny : undefined }))
			.then((): void => undefined);
	}

	public deletePlayChildren(playId: string, childId: string): Promise<void> {
		return this._redisRepository.hdel(`akashic:parent_plays:${childId}`, playId).then((): void => undefined);
	}

	public addPlaysNicoliveMetadata(playId: string, providerType: string): Promise<void> {
		return this._database.repositories.playsNicoliveMetadata.save(playId, providerType);
	}

	private async _startPlay(play: dataTypes.Play, connection?: tapper.Connection): Promise<dataTypes.Play> {
		// キュー等のpublishのセットアップ
		try {
			await this.playlogFixture.preparePublishPlaylog(play.id);
		} catch (err) {
			this.logger.error("prepare queue/exchange/publish failed", context({ playId: play.id, error: err }));
			throw err;
		}
		return await this._updateStatus(play, dataTypes.Constants.PLAY_STATE_RUNNING, connection);
	}

	private async _stopPlay(play: dataTypes.Play, connection?: tapper.Connection): Promise<dataTypes.Play> {
		// キューのクリーンアップ
		try {
			await this.playlogFixture.cleanupPublishPlaylog(play.id);
		} catch (e) {
			// 例外処理中のエラーは無視 (ロギングのみ)
			this.logger.warn("deleting queue/exchange failed.", context({ playId: play.id, error: e }));
		}
		return await this._updateStatus(play, dataTypes.Constants.PLAY_STATE_SUSPENDING, connection);
	}

	private _updateStatus(play: dataTypes.Play, status: string, connection?: tapper.Connection): Promise<dataTypes.Play> {
		return this._database.repositories.play.update(
			new dataTypes.Play({
				id: play.id,
				gameCode: play.gameCode,
				parentId: play.parentId,
				started: play.started,
				finished: play.finished,
				status,
			}),
			connection,
		);
	}

	// updatePlay() 時の遷移条件チェック
	// プレー停止/再開のみ許可
	private _checkStatus(play: dataTypes.Play, targetStatus: string): Promise<dataTypes.Play> {
		if (
			(play.status === dataTypes.Constants.PLAY_STATE_RUNNING && targetStatus === dataTypes.Constants.PLAY_STATE_SUSPENDING) ||
			(play.status === dataTypes.Constants.PLAY_STATE_SUSPENDING && targetStatus === dataTypes.Constants.PLAY_STATE_RUNNING)
		) {
			return Promise.resolve(play);
		} else {
			return Promise.reject(new restCommons.Errors.Conflict("play status conflict (current: " + play.status + ")"));
		}
	}
}
