import config from "config";
import * as nock from "nock";
import Constants from "./Constants";

export default class Server {
	public permissionServer = nock(config.get("tokenValidator.permissionServer.url"));
	public playServer = nock(config.get("playServer.url"));

	public validateToken(status, data) {
		this.permissionServer = this.permissionServer.post("/v1.0/tokens/validate");
		if (status >= 400) {
			this.permissionServer = this.permissionServer.reply(status, {
				meta: { status, errorCode: 1 },
			});
			return this;
		}

		this.permissionServer = this.permissionServer.reply(status, {
			meta: { status },
			data: {
				id: data.id,
				playId: data.playId,
				value: data.value,
				hash: "dummy",
				expire: data.expire.toString(),
				permission: this.createPermission(data),
				meta: {
					userId: getUserId(data),
				},
			},
		});
		return this;
	}

	public getPlay(status, data) {
		const playId = data.playId;
		const gameCode = data.gameCode;
		this.playServer = this.playServer.get("/v1.0/plays/" + encodeURIComponent(playId));
		if (status >= 400) {
			this.playServer = this.playServer.reply(status, {
				meta: { status, errorCode: 1 },
			});
			return this;
		}

		this.playServer = this.playServer.reply(status, {
			meta: { status },
			data: {
				id: playId,
				gameCode,
				started: new Date(),
				status: "running",
			},
		});
		return this;
	}

	public createPermission(data) {
		return {
			writeTick: data.writeTick,
			readTick: data.readTick,
			subscribeTick: data.subscribeTick,
			sendEvent: data.sendEvent,
			subscribeEvent: data.subscribeEvent,
			maxEventPriority: data.maxEventPriority,
		};
	}
}

function getUserId(data) {
	switch (data.value) {
		case "active":
			return Constants.activeUserId;
		case "passive":
			return Constants.passiveUserId;
		default:
			return data.meta ? data.meta.userId : undefined;
	}
}
