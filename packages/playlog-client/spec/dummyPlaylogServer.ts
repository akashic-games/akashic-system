// テストに使うplaylog-server
// 怪しい機能がたくさんある

import * as amflow from "@akashic/amflow";
import * as amflowMessage from "@akashic/amflow-message";
import * as amtp from "@akashic/amtplib";
import * as lu from "@akashic/log-util";
import * as playlog from "@akashic/playlog";
import * as serverEngine from "@akashic/playlog-server-engine";
import { ExcludeEventFlags } from "@akashic/akashic-system";
import assert from "assert";
import * as log4js from "log4js";
import * as querystring from "querystring";
import * as url from "url";
import * as ws from "ws";
import Request = amflowMessage.Request;
import Response = amflowMessage.Response;
import Opcode = amflowMessage.Opcode;

const logger = new lu.LogUtil(log4js.getLogger("out"));

/* サーバ実行パラメータ - ここから */

// パーミッション
// キーはトークン文字列
const permissions: { [name: string]: amflow.Permission } = {
	passive: {
		readTick: true,
		writeTick: false,
		sendEvent: true,
		subscribeEvent: false,
		subscribeTick: true,
		maxEventPriority: 3,
	},
	active: {
		readTick: true,
		writeTick: true,
		sendEvent: false,
		subscribeEvent: true,
		subscribeTick: false,
		maxEventPriority: 2,
	},
	full: {
		readTick: true,
		writeTick: true,
		sendEvent: true,
		subscribeEvent: true,
		subscribeTick: true,
		maxEventPriority: 3,
	},
};

// playId: --auto-tick-streamを指定された場合に自動的に送信するTickのリスト
const autoStreamingTicks: playlog.Tick[] = [];
for (let i = 1; i <= 1000; ++i) {
	const t: playlog.Tick = [i];
	// 10フレームおきにイベントを含む
	if (i % 10 === 0) {
		const e: playlog.Event[] = [];
		const num = Math.round(Math.random() * 10) + 1;
		for (let j = 0; j < num; j++) {
			e.push(createRandomPointDownEvent());
		}
		t[1] = e;
	}
	autoStreamingTicks.push(t);
}

// playId: --auto-tick-streamを指定された場合に自動的にTickを送信する間隔
const sendTickInterval = 33;

// playId: --auto-event-streamを指定された場合に自動的に送信するEventのリスト
const autoStreamingEvents: playlog.Event[] = [];

// playId: --auto-event-streamを指定された場合に自動的にEventを送信する間隔
const sendEventInterval = 100;

// console.logを無効にするか否か
const disableLog = false;
/* サーバ実行パラメータ - ここまで */

const clients: { [s: string]: AMFlowImpl[] } = {};
export type getTickListCallback = (error: Error | null, tickList?: playlog.TickList) => void;

class AMFlowImpl implements serverEngine.AMFlowLike {
	public playId: string;
	public sendTickTimer: NodeJS.Timer;
	public sendTickFrame: number;
	public sendEventTimer: NodeJS.Timer;

	public tickHandlers: Array<(tick: Buffer) => void>;
	public eventHandlers: Array<(event: Buffer) => void>;
	constructor() {
		this.playId = null;
		this.sendTickTimer = null;
		this.sendTickFrame = 0;
		this.sendEventTimer = null;
		this.tickHandlers = [];
		this.eventHandlers = [];
	}
	public open(playId: string, callback?: (error?: Error) => void): void {
		this.playId = playId;
		if (!clients[playId]) {
			clients[playId] = [];
		}
		clients[playId].push(this);
		if (callback) {
			setImmediate(() => {
				callback();
			});
		}
	}
	public close(callback?: (error?: Error) => void): void {
		if (clients[this.playId]) {
			const idx = clients[this.playId].indexOf(this);
			if (idx !== -1) {
				clients[this.playId].splice(idx, 1);
			}
		}
		if (this.playId === "--auto-tick-stream") {
			this.stopSendTickTimer();
		}
		if (this.playId === "--auto-event-stream") {
			this.stopSendEventTimer();
		}
		if (callback) {
			setImmediate(() => {
				callback();
			});
		}
	}
	public authenticate(token: string, callback: (error: Error, permission: amflow.Permission) => void): void {
		if (this.playId === "--auto-tick-stream") {
			this.stopSendTickTimer();
		}
		if (this.playId === "--auto-event-stream") {
			this.stopSendEventTimer();
		}
		if (this.playId === "--auto-tick-stream") {
			this.startSendTickTimer();
		}
		if (this.playId === "--auto-event-stream") {
			this.startSendEventTimer();
		}
		const permission = permissions[token];
		assert(permission);
		setImmediate(() => {
			callback(null, permission);
		});
	}
	public sendTick(tick: playlog.Tick): void {
		throw new Error("not implemented");
	}
	public sendRawTick(tick: Buffer): void {
		const list = clients[this.playId];
		if (list) {
			list.forEach((c) => c.fireTickHandler(tick));
		}
	}
	public onTick(handler: (tick: playlog.Tick) => void): void {
		throw new Error("not implemented");
	}
	public offTick(handler: (tick: playlog.Tick) => void): void {
		throw new Error("not implemented");
	}
	public onRawTick(handler: (tick: Buffer) => void): void {
		this.tickHandlers.push(handler);
	}
	public offRawTick(handler: (tick: Buffer) => void): void {
		this.tickHandlers = this.tickHandlers.filter((h) => h !== handler);
	}
	public sendEvent(event: playlog.Event): void {
		throw new Error("not implemented");
	}
	public onEvent(handler: (event: playlog.Event) => void): void {
		throw new Error("not implemented");
	}
	public offEvent(handler: (event: playlog.Event) => void): void {
		throw new Error("not implemented");
	}
	public sendRawEvent(event: Buffer): void {
		const list = clients[this.playId];
		if (list) {
			list.forEach((c) => c.fireEventHandler(event));
		}
	}
	public onRawEvent(handler: (event: Buffer) => void): void {
		this.eventHandlers.push(handler);
	}
	public offRawEvent(handler: (event: Buffer) => void): void {
		this.eventHandlers = this.eventHandlers.filter((h) => h !== handler);
	}
	public getRawTickList(
		begin: number,
		end: number,
		callback: (error: Error, tickList: Buffer[]) => void,
		excludeEventFlags?: ExcludeEventFlags,
	): void {
		if (this.playId === "--fail-requests") {
			const error = new Error("intended fail");
			error.name = "RuntimeError";
			callback(error, null);
			return;
		}
		const t: playlog.Tick[] = [];
		const ticks = autoStreamingTicks;
		for (let i = 0; i < ticks.length; ++i) {
			if (ticks[i][0] >= begin && ticks[i][0] < end) {
				t.push(ticks[i]);
			}
		}
		callback(
			null,
			t.map((c) => amflowMessage.encodeTick(c)),
		);
	}

	public getTickList(begin: number, end: number, callback: getTickListCallback): void;
	public getTickList(opts: amflow.GetTickListOptions, callback: getTickListCallback): void;
	public getTickList(
		beginOrOpts: number | amflow.GetTickListOptions,
		endOrCallback: number | getTickListCallback,
		callback?: getTickListCallback,
	): void {
		callback(new Error("not implemented"), null);
	}

	public putStartPoint(startPoint: amflow.StartPoint, callback: (error: Error) => void): void {
		if (this.playId === "--fail-requests") {
			const error = new Error("intended fail");
			error.name = "RuntimeError";
			callback(error);
			return;
		}
		callback(null);
	}
	public getStartPoint(opts: { frame: number }, callback: (error: Error, startPoint: amflow.StartPoint) => void): void {
		if (this.playId === "--fail-requests") {
			const error = new Error("intended fail");
			error.name = "RuntimeError";
			callback(error, null);
			return;
		}
		let startPoint: amflow.StartPoint = null;
		if (opts.frame) {
			startPoint = { frame: opts.frame, data: "foo", timestamp: 0 };
		} else {
			startPoint = { frame: 0, data: "bar", timestamp: 0 };
		}
		callback(null, startPoint);
	}
	public putStorageData(key: playlog.StorageKey, value: playlog.StorageValue, options: any, callback: (err: Error) => void): void {
		if (this.playId === "--fail-requests") {
			const error = new Error("intended fail");
			error.name = "RuntimeError";
			callback(error);
			return;
		}
		callback(null);
	}
	public getStorageData(keys: playlog.StorageReadKey[], callback: (error: Error, values: playlog.StorageData[]) => void): void {
		if (this.playId === "--fail-requests") {
			const error = new Error("initialize fail");
			error.name = "RuntimeError";
			callback(error, null);
			return;
		}
		// dummy data
		const storageData: playlog.StorageData[] = [
			{
				readKey: { region: 1, regionKey: "foo.bar", userId: "300", gameId: "dummy" },
				values: [{ data: "apple" }],
			},
		];
		callback(null, storageData);
	}
	public startSendTickTimer(): void {
		this.sendTickTimer = setInterval(() => {
			const tick: playlog.Tick = autoStreamingTicks[this.sendTickFrame];
			const encoded = amflowMessage.encodeTick(tick);
			this.tickHandlers.forEach((h) => {
				h(encoded);
			});
			this.sendTickFrame++;
			if (this.sendTickFrame === autoStreamingTicks.length) {
				this.sendTickFrame = 0;
			}
		}, sendTickInterval);
	}
	public stopSendTickTimer(): void {
		if (this.sendTickTimer) {
			clearInterval(this.sendTickTimer);
		}
		this.sendTickTimer = null;
	}
	public startSendEventTimer(): void {
		this.sendEventTimer = setInterval(() => {
			const event = createRandomPointDownEvent();
			const encoded = amflowMessage.encodeEvent(event);
			this.eventHandlers.forEach((h) => {
				h(encoded);
			});
		}, sendEventInterval);
	}
	public stopSendEventTimer(): void {
		if (this.sendEventTimer) {
			clearInterval(this.sendEventTimer);
		}
		this.sendEventTimer = null;
	}
	public fireEventHandler(event: Buffer): void {
		this.eventHandlers.forEach((h) => h(event));
	}
	public fireTickHandler(tick: Buffer): void {
		this.tickHandlers.forEach((h) => h(tick));
	}
}

class MockFactory implements serverEngine.Factory {
	public createAMFlow(): serverEngine.AMFlowLike {
		return new AMFlowImpl();
	}
}

function createRandomPointDownEvent(): playlog.Event {
	const pointerId = Math.round(Math.random() * 100) + 1;
	const x = Math.round(Math.random() * 1000);
	const y = Math.round(Math.random() * 1000);
	const entityId = Math.round(Math.random() * 100) + 1;
	return [0x21, 2, "tom", pointerId, x, y, entityId];
}

const socketType = process.env.SOCKET_TYPE || "websocket";
if (socketType !== "engineio" && socketType !== "websocket") {
	console.error("Unknown socket type: " + socketType);
	process.exit(1);
}
console.info("Server started as " + socketType + " server.");

const factory = new MockFactory();
const server = new serverEngine.WebSocketServer(factory, logger);

server.listen(Number(process.env.ZUUL_PORT) || 3000);
server.on("session", (session: serverEngine.Session) => {
	session.on("validation-request", (playId: string, token: string, callback: (ok: boolean) => void) => {
		if (playId === "session-fail") {
			callback(false);
		} else {
			callback(true);
		}
	});
});
