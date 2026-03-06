import * as dt from "@akashic/server-engine-data-types";
import PlayTokenWithUrl from "./PlayTokenWithUrl";
import { PlayTokenWithUrlLike } from "./PlayTokenWithUrlLike";

describe("PlayTokenWithUrl", () => {
	it("fromTokenAndUrl", (done: Function) => {
		const permission: string = "120";
		const playToken: dt.PlayToken = dt.PlayToken.fromObject({
			id: "1",
			playId: "3",
			value: "value",
			expire: new Date(),
			permission: "120",
			hash: "abc",
			meta: { userId: "2" },
		});
		const url: string = "http://spec.com";
		const result: PlayTokenWithUrl = PlayTokenWithUrl.fromTokenAndUrl(playToken, url, permission);
		expect(result).toBeTruthy();
		expect(result.id).toEqual(playToken.id);
		expect(result.playId).toEqual(playToken.playId);
		expect(result.value).toEqual(playToken.value);
		expect(result.expire).toEqual(playToken.expire);
		expect(result.permission).toEqual(permission);
		expect(result.url).toEqual(url);
		expect(result.meta.userId).toEqual(playToken.meta.userId);
		const json: PlayTokenWithUrlLike = result.toJSON();
		expect(json).toBeTruthy();
		expect(json.id).toEqual(playToken.id);
		expect(json.playId).toEqual(playToken.playId);
		expect(json.value).toEqual(playToken.value);
		expect(json.expire).toEqual(playToken.expire);
		expect(json.permission).toEqual(permission);
		expect(json.url).toEqual(url);
		expect(json.meta.userId).toEqual(playToken.meta.userId);
		done();
	});
	it("fromTokenAndUrl, none meta.userId", (done: Function) => {
		const permission: any = {
			writeTick: true,
			readTick: true,
			subscribeTick: true,
			sendEvent: true,
			subscribeEvent: true,
			maxEventPriority: 2,
		};
		const playToken: dt.PlayToken = dt.PlayToken.fromObject({
			id: "1",
			playId: "3",
			value: "value",
			expire: new Date(),
			permission,
			hash: "abc",
		});
		const url: string = "http://spec.com";
		const result: PlayTokenWithUrl = PlayTokenWithUrl.fromTokenAndUrl(playToken, url, permission);
		expect(result).toBeTruthy();
		expect(result.id).toEqual(playToken.id);
		expect(result.playId).toEqual(playToken.playId);
		expect(result.value).toEqual(playToken.value);
		expect(result.expire).toEqual(playToken.expire);
		expect(result.permission).toEqual(playToken.permission);
		expect(result.url).toEqual(url);
		expect(result.meta).toBeUndefined();
		const json: PlayTokenWithUrlLike = result.toJSON();
		expect(json).toBeTruthy();
		expect(json.id).toEqual(playToken.id);
		expect(json.playId).toEqual(playToken.playId);
		expect(json.value).toEqual(playToken.value);
		expect(json.expire).toEqual(playToken.expire);
		expect(json.permission).toEqual(playToken.permission);
		expect(json.url).toEqual(url);
		expect(json.meta).toBeUndefined();
		done();
	});
	it("fromToken", (done: Function) => {
		const permission: any = {
			writeTick: true,
			readTick: true,
			subscribeTick: true,
			sendEvent: true,
			subscribeEvent: true,
			maxEventPriority: 2,
		};
		const playToken: dt.PlayToken = dt.PlayToken.fromObject({
			id: "1",
			playId: "3",
			value: "value",
			expire: new Date(),
			permission,
			hash: "abc",
		});
		const result: PlayTokenWithUrl = PlayTokenWithUrl.fromToken(playToken, permission);
		expect(result).toBeTruthy();
		expect(result.id).toEqual(playToken.id);
		expect(result.playId).toEqual(playToken.playId);
		expect(result.value).toEqual(playToken.value);
		expect(result.expire).toEqual(playToken.expire);
		expect(result.permission).toEqual(playToken.permission);
		expect(result.url).toBeUndefined();
		expect(result.meta).toBeUndefined();
		const json: PlayTokenWithUrlLike = result.toJSON();
		expect(json).toBeTruthy();
		expect(json.id).toEqual(playToken.id);
		expect(json.playId).toEqual(playToken.playId);
		expect(json.value).toEqual(playToken.value);
		expect(json.expire).toEqual(playToken.expire);
		expect(json.permission).toEqual(playToken.permission);
		expect(json.url).toBeUndefined();
		expect(json.meta).toBeUndefined();
		done();
	});
});
