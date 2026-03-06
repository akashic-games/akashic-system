import * as restCommons from "@akashic/akashic-rest-commons";
import * as amflow from "@akashic/amflow";
import * as amflowMessage from "@akashic/amflow-message";
import * as playlog from "@akashic/playlog";
import * as playlogAmqp from "@akashic/playlog-amqp";

import * as amqp from "amqplib";
import * as msgpack from "msgpack-lite";

import { AmqpConnectionManager, AmqpNotFoundError } from "@akashic/amqp-utils";
import { EventType, PlayTokenAMQP } from "@akashic/playtoken-amqp";
import { ExcludeEventFlags } from "@akashic/akashic-system";
import * as playlogStore from "./PlaylogStore";
import * as PlaylogStore from "./PlaylogStore";
import { CopyPlaylogRequest, CreatePlaylogEventRequest } from "./PlayServerService";
import ServerServiceMarkerInterface from "./ServerServiceMarkerInterface";

export default class PlaylogApiServerService implements ServerServiceMarkerInterface {
	private amqpConnectionManager: AmqpConnectionManager;
	private playlogStore: playlogStore.PlaylogStore;

	constructor(amqpConnectionManager: AmqpConnectionManager, playlogStore: PlaylogStore.PlaylogStore) {
		this.amqpConnectionManager = amqpConnectionManager;
		this.playlogStore = playlogStore;
	}

	/**
	 * プレーイベントの通知
	 * POST /v1.0/plays/:id/events
	 */
	public createEvent(id: string, args: CreatePlaylogEventRequest): Promise<void> {
		const type = args.type;
		const values = args.values;

		let publishEventResult: Promise<void>;
		switch (type) {
			case "JoinPlayer":
				publishEventResult = this.publishJoinEvent(id, values.userId, values.name);
				break;
			case "LeavePlayer":
				publishEventResult = this.publishLeaveEvent(id, values.userId);
				break;
			case "Message":
				publishEventResult = this.publishMessageEvent(id, values.userId, values.event, values.priority, values.excludeEventFlags);
				break;
			default:
				publishEventResult = Promise.reject(new restCommons.Errors.InvalidParameter("invalid parameter", "type is not valid"));
		}

		return publishEventResult;
	}

	/**
	 * プレーログの取得
	 * GET /v1.0/plays/:id/playlog
	 *
	 * @throws restCommons.Errors.NotFound  404 (NOT_FOUND) : データが存在しない
	 */
	public getPlaylog(id: string, excludeEventFlags?: ExcludeEventFlags): Promise<string> {
		return this.playlogStore.getPlaylogData(id, excludeEventFlags).then((data: playlogStore.PlayData) => {
			if (!data) {
				throw new restCommons.Errors.NotFound("playlog not found");
			}
			return msgpack.encode(data).toString("base64");
		});
	}

	/**
	 * プレーログの保存 (派生プレー作成用)
	 * POST /v1.0/plays/:id/playlog
	 *
	 * @param id コピー先プレー ID
	 * @param args コピー元情報
	 *
	 * @throws restCommons.Errors.InvalidParameter
	 * @throws restCommons.Errors.NotFound  404 (NOT_FOUND): コピー元の playId にデータが存在しない
	 * @throws restCommons.Errors.Conflict 409 (CONFLICT): コピー先の playId にデータがすでに存在する
	 */
	public async copyPlaylog(destPlayId: string, args: CopyPlaylogRequest): Promise<void> {
		const originPlayId = args.playId;
		const playData = args.playData;
		const count = args.count;
		const ignorablePlayData = args.ignorablePlayData;

		if (!originPlayId && !playData) {
			return Promise.reject(new restCommons.Errors.InvalidParameter("playId or playData required"));
		}

		let data: PlaylogStore.PlayData;
		let ignorableData: PlaylogStore.PlayData;
		// playlogが渡されてきていればdecodeする
		if (playData) {
			try {
				data = await this.getDecodedPlaylog(playData);
			} catch (error) {
				return Promise.reject(new restCommons.Errors.InvalidParameter("invalid playData (can't decode)", error));
			}
			if (ignorablePlayData) {
				try {
					ignorableData = await this.getDecodedPlaylog(ignorablePlayData);
				} catch (error) {
					return Promise.reject(new restCommons.Errors.InvalidParameter("invalid playData (can't decode)", error));
				}
			}
		}

		if (!(await this.playlogStore.exists(destPlayId))) {
			// コピー対象のplaylogがAPIリクエスト時に渡されきてている
			if (data) {
				try {
					await this.playlogStore.putPlaylogData(destPlayId, data, count);
					// ignorableなplaylogも渡されてきている
					if (ignorableData) {
						await this.playlogStore.putPlaylogData(destPlayId, ignorableData, count, { ignorable: true });
					}
				} catch (err) {
					throw new restCommons.Errors.NotFound("no playlog data for playId " + originPlayId);
				}
				return;
			} else {
				// コピー対象のplayIdのみ渡されてきている
				await this.copyStoredPlaylog(destPlayId, originPlayId, count);
			}
		} else {
			return Promise.reject(new restCommons.Errors.Conflict("playlog data already exists"));
		}
	}

	/**
	 * start point データの送信
	 *
	 * POST /v1.0/plays/:id/startpoints に対応する
	 *
	 * @param id 対象プレー ID
	 * @param startPoint AMFlow start point データ
	 */
	public putStartPoint(id: string, startPoint: amflow.StartPoint): Promise<void> {
		if (typeof startPoint !== "object") {
			return Promise.reject(new restCommons.Errors.InvalidParameter("invalid parameter", "startPoint data is not valid"));
		}

		return this.playlogStore.putStartPoint(id, startPoint);
	}

	/**
	 * プレーログ tick データの送信
	 *
	 * POST /v1.0/plays/:id/ticks に対応する
	 *
	 * @param id 対象プレー ID
	 * @param tick プレーログ tick データ
	 */
	public putTick(id: string, tick: playlog.Tick): Promise<void> {
		if (!Array.isArray(tick)) {
			return Promise.reject(new restCommons.Errors.InvalidParameter("invalid parameter", "tick data is not valid"));
		}

		return this.publishTick(id, tick).then(() => this.playlogStore.putTick(id, tick));
	}

	/**
	 * プレーログの tick データを更新
	 *
	 * PUT /v1.0/plays/:id/ticks に対応する
	 *
	 * @param id 対象プレー ID
	 * @param tick プレーログ tick データ
	 */
	public updateTick(id: string, tick: playlog.Tick): Promise<void> {
		return this.playlogStore.updateTick(id, tick);
	}

	/**
	 * playlog-serverのtickのキャッシュを削除
	 *
	 * PUT /v1.0/plays/:playId/ticks に対応する
	 * @param playId
	 */
	public deleteCache(playId: string): Promise<void> {
		return this.amqpConnectionManager.publishObject(PlayTokenAMQP.EXCHANGE, String(EventType.Purge), {
			playId,
		});
	}

	private async copyStoredPlaylog(destPlayId: string, originPlayId: string, count: number) {
		const storedData = await this.playlogStore.getPlaylogData(originPlayId);
		if (!storedData) {
			throw new restCommons.Errors.NotFound("no playlog data for playId " + originPlayId);
		}
		await this.playlogStore.putPlaylogData(destPlayId, storedData, count);
		// ignorableなplaylogが存在すれば、それもコピーする
		const storedIgnorableData = await this.playlogStore.getPlaylogData(originPlayId, { ignorable: true });
		if (!storedIgnorableData) {
			return;
		}
		await this.playlogStore.putPlaylogData(destPlayId, storedIgnorableData, count, { ignorable: true });
		return;
	}

	private publishEvent(playId: string, event: playlog.Event): Promise<void> {
		const priority = event[playlog.EventIndex.EventFlags];
		const opts: amqp.Options.Publish = {
			priority,
		};
		const maskedPriority = priority & playlogAmqp.Event.PRIORITY_MASK;
		if (maskedPriority !== playlogAmqp.Event.MAX_PRIORITY) {
			opts.expiration = playlogAmqp.Event.NON_MAX_PRIORITY_EVENT_TTL;
		}
		return this.amqpConnectionManager
			.publish(`${playlogAmqp.Event.EXCHANGE_PREFIX}.${playId}`, "", amflowMessage.encodeEvent(event), opts)
			.catch((err) => {
				if (err instanceof AmqpNotFoundError) {
					return Promise.reject(new restCommons.Errors.NotFound("event exchange or queue not found"));
				} else {
					return Promise.reject(err);
				}
			});
	}

	private publishJoinEvent(playId: string, userId: string, name: string): Promise<void> {
		if (!userId || !name) {
			return Promise.reject(new restCommons.Errors.InvalidParameter("invalid parameter", "values is not valid for JoinPlayer"));
		}
		const joinEvent: playlog.JoinEvent = [playlog.EventCode.Join, playlogAmqp.Event.MAX_PRIORITY, userId, name];
		return this.publishEvent(playId, joinEvent);
	}

	private publishLeaveEvent(playId: string, userId: string): Promise<void> {
		if (!userId) {
			return Promise.reject(new restCommons.Errors.InvalidParameter("invalid parameter", "values is not valid for LeavePlayer"));
		}
		const leaveEvent: playlog.LeaveEvent = [playlog.EventCode.Leave, playlogAmqp.Event.MAX_PRIORITY, userId];
		return this.publishEvent(playId, leaveEvent);
	}

	private publishMessageEvent(
		playId: string,
		userId: string,
		event: any,
		priority?: number,
		excludeEventFlags?: { ignorable?: boolean; transient?: boolean },
	): Promise<void> {
		if (!userId || !event) {
			return Promise.reject(new restCommons.Errors.InvalidParameter("invalid parameter", "values is not valid for Message"));
		}
		if (typeof priority !== "number") {
			priority = playlogAmqp.Event.MAX_PRIORITY;
		}
		if (excludeEventFlags?.transient) {
			priority = priority | playlogAmqp.Event.TRANSIENT_MASK;
		} else if (excludeEventFlags?.ignorable) {
			priority = priority | playlogAmqp.Event.IGNORABLE_MASK;
		}
		const messageEvent: playlog.MessageEvent = [playlog.EventCode.Message, priority, userId, event];
		return this.publishEvent(playId, messageEvent);
	}

	private publishTick(playId: string, tick: playlog.Tick): Promise<void> {
		return this.amqpConnectionManager
			.publish(`${playlogAmqp.Tick.EXCHANGE_PREFIX}.${playId}`, "", amflowMessage.encodeTick(tick))
			.catch((err) => {
				if (err instanceof AmqpNotFoundError) {
					return Promise.reject(new restCommons.Errors.NotFound("event exchange or queue not found"));
				} else {
					return Promise.reject(err);
				}
			});
	}

	private async getDecodedPlaylog(playData: string): Promise<PlaylogStore.PlayData> {
		let data: PlaylogStore.PlayData;
		try {
			data = msgpack.decode(Buffer.from(playData, "base64"));
		} catch (error) {
			return Promise.reject(new restCommons.Errors.InvalidParameter("invalid playData (can't decode)", error));
		}
		if (!data.tickList || !data.startPoints) {
			return Promise.reject(new restCommons.Errors.InvalidParameter("invalid playData (no tick or startPoint data)"));
		}
		// frame が 0 から始まっていない or frame 0 の StartPoint が存在しない場合はエラー
		if (data.tickList[0] !== 0 || data.startPoints[0].frame !== 0) {
			return Promise.reject(new restCommons.Errors.InvalidParameter("invalid playData (no frame 0 data)"));
		}
		return data;
	}
}
