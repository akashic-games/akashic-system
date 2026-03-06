import { context, ILogger } from "@akashic-system/logger";
import * as cb from "@akashic/callback-publisher";
import { Constants } from "@akashic/server-engine-data-types";
import * as amqp from "amqplib";
import { TickExporter } from "../../callback/TickExporter";
import { AmqpConsumer } from "../../util/AmqpConsumer";
import { InstanceNotification } from "./InstanceNotification";

export namespace InstanceConsumer {
	let _notification: InstanceNotification;
	let _tickExporter: TickExporter | null;
	let _logger: ILogger;

	export function consume(
		amqpConsumer: AmqpConsumer,
		notification: InstanceNotification,
		tickExporter: TickExporter | null,
		logger: ILogger,
	): void {
		_notification = notification;
		_tickExporter = tickExporter;
		_logger = logger;

		amqpConsumer.on(Constants.EVENT_HANDLER_TYPE_INSTANCE_STATUS, (msg: amqp.Message) => {
			_instanceStatusChanged(msg);
		});
		amqpConsumer.on(Constants.EVENT_HANDLER_TYPE_ERROR, (msg: amqp.Message) => {
			_instanceError(msg);
		});
		amqpConsumer.on(Constants.EVENT_HANDLER_TYPE_GAME_EVENT, (msg: amqp.Message) => {
			_gameEvent(msg);
		});
	}

	function _instanceStatusChanged(msg: amqp.Message): void {
		const event = cb.Event.fromBuffer<cb.Instance>(msg.content);
		const ctx = context({ playId: event.payload.playId, instanceId: event.payload.instanceId });
		_logger.trace("インスタンス状態変更イベント取得", ctx);
		_notification
			.fire(event.payload.instanceId, Constants.EVENT_HANDLER_TYPE_INSTANCE_STATUS, event, () =>
				_logger.trace("インスタンス状態変更通知用のイベントハンドラが登録されていません", ctx),
			)
			.catch(() => {
				_logger.error("インスタンス状態変更イベントを通知できませんでした", ctx);
			});
	}

	function _instanceError(msg: amqp.Message): void {
		const event = cb.Event.fromBuffer<cb.InstanceError>(msg.content);
		const ctx = context({ instanceId: event.payload.instanceId });
		_logger.trace("インスタンスのエラーイベント取得", ctx);
		_notification
			.fire(event.payload.instanceId, Constants.EVENT_HANDLER_TYPE_ERROR, event, () =>
				_logger.trace("インスタンスエラー通知用のイベントハンドラが登録されていません", ctx),
			)
			.catch(() => {
				_logger.error("インスタンスのエラーイベントを通知できませんでした", ctx);
			});
	}

	function _gameEvent(msg: amqp.Message): void {
		const event = cb.Event.fromBuffer<cb.GameEvent>(msg.content);
		const ctx = context({ instanceId: event.payload.instanceId });

		if (_tickExporter && event.payload && event.payload.playId && event.payload.data) {
			if (event.payload.data.type === "ExportStartPoint") {
				_tickExporter.putStartPoint(event.payload.playId, event.payload.data.startPoint).catch(() => {
					_logger.error("start point の送信に失敗しました", ctx);
				});
				return;
			} else if (event.payload.data.type === "ExportTick") {
				_tickExporter.putTick(event.payload.playId, event.payload.data.tick).catch(() => {
					_logger.error("tick の送信に失敗しました", ctx);
				});
				return;
			}
		}

		_logger.trace("ゲームイベント取得", ctx);
		_notification
			.fire(event.payload.instanceId, Constants.EVENT_HANDLER_TYPE_GAME_EVENT, event, () =>
				_logger.trace("ゲームイベント通知用のイベントハンドラが登録されていません", ctx),
			)
			.catch(() => {
				_logger.error("ゲームイベントを通知できませんでした", ctx);
			});
	}
}
