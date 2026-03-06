import { AmqpChannelHolder, AmqpConnectionManager } from "@akashic/amqp-utils";
import * as amqp from "amqplib";
import { EventEmitter } from "events";
import * as constants from "./constants";
import { InstanceRequestMessage } from "./messages";
import { setup } from "./setup";

export class InstanceRequestConsumer extends EventEmitter {
	private _amqpConnectionManager: AmqpConnectionManager;
	private _amqpChannelHolder: AmqpChannelHolder;
	private _onRequest: (msg: InstanceRequestMessage<any>) => Promise<boolean> | boolean;

	/**
	 * @param amqpConnectionManager amqp 接続
	 * @param onRequest リクエストのハンドラ (ack するときは boolean、nack するときは false を返す)
	 */
	constructor(amqpConnectionManager: AmqpConnectionManager, onRequest: (msg: InstanceRequestMessage<any>) => Promise<boolean> | boolean) {
		super();
		this._amqpConnectionManager = amqpConnectionManager;
		this._amqpChannelHolder = new AmqpChannelHolder(amqpConnectionManager);
		this._amqpChannelHolder.on("connect", async () => {
			await this._onConnected();
		});
		this._amqpChannelHolder.on("close", async () => {
			await this._onClosed();
		});
		this._onRequest = onRequest;
	}

	public async start(): Promise<void> {
		await setup(this._amqpConnectionManager);
		await this._amqpChannelHolder.start();
	}

	public async stop(): Promise<void> {
		await this._amqpChannelHolder.stop();
	}

	private async _onConnected(): Promise<void> {
		const channel = this._amqpChannelHolder.channel;
		if (channel == null) {
			throw new Error("Logic Exception: amqp channel is null. You should start before connect.");
		}
		await channel.prefetch(1);
		await channel.consume(
			constants.INSTANCE_REQUEST_QUEUE,
			async (msg) => {
				await this._onMessage(channel, msg);
			},
			{},
		);
		this.emit("connect");
	}

	private async _onClosed(): Promise<void> {
		this.emit("close");
	}

	private async _onMessage(channel: amqp.Channel, msg: amqp.Message | null): Promise<void> {
		if (!msg) {
			return;
		}
		try {
			const request = JSON.parse(msg.content.toString("utf8")) as InstanceRequestMessage<any>;
			if (typeof request.instanceId !== "string") {
				throw new Error("invalid instanceId");
			}
			if (typeof request.type !== "string") {
				throw new Error("invalid request type");
			}
			const ack = await this._onRequest(request);
			if (ack) {
				await channel.ack(msg);
			} else {
				await channel.nack(msg);
			}
		} catch (err) {
			this.emit("unhandledMessage", err);
			await channel.ack(msg);
		}
	}
}
