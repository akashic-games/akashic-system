import { PlayTokenPermission } from "./PlayTokenPermission";
import { PlayTokenPermissionLike } from "./PlayTokenPermissionLike";

describe("PlayTokenPermission", () => {
	it("test-constructor", () => {
		const permissionValue: PlayTokenPermissionLike = {
			writeTick: true,
			readTick: false,
			subscribeTick: true,
			sendEvent: false,
			subscribeEvent: true,
			maxEventPriority: 1,
		};
		const permission: PlayTokenPermission = new PlayTokenPermission(permissionValue);
		expect(permission.writeTick).toBeTruthy();
		expect(permission.readTick).toBeFalsy();
		expect(permission.subscribeTick).toBeTruthy();
		expect(permission.sendEvent).toBeFalsy();
		expect(permission.subscribeEvent).toBeTruthy();
		expect(permission.maxEventPriority).toEqual(1);
	});

	it("test-generate-from-object", () => {
		// 指定要素なし、全てデフォルト(フラグ：false, プライオリティ：0)
		let permission: PlayTokenPermission = PlayTokenPermission.generate({});
		expect(permission.writeTick).toBeFalsy();
		expect(permission.readTick).toBeFalsy();
		expect(permission.subscribeTick).toBeFalsy();
		expect(permission.sendEvent).toBeFalsy();
		expect(permission.subscribeEvent).toBeFalsy();
		expect(permission.maxEventPriority).toEqual(0);
		// tick のみ指定
		const tickOnly = {
			writeTick: true,
			readTick: true,
			subscribeTick: true,
		};
		permission = PlayTokenPermission.generate(tickOnly);
		expect(permission.writeTick).toBeTruthy();
		expect(permission.readTick).toBeTruthy();
		expect(permission.subscribeTick).toBeTruthy();
		expect(permission.sendEvent).toBeFalsy();
		expect(permission.subscribeEvent).toBeFalsy();
		expect(permission.maxEventPriority).toEqual(0);
		// event のみ指定
		const eventOnly = {
			sendEvent: true,
			subscribeEvent: true,
		};
		permission = PlayTokenPermission.generate(eventOnly);
		expect(permission.writeTick).toBeFalsy();
		expect(permission.readTick).toBeFalsy();
		expect(permission.subscribeTick).toBeFalsy();
		expect(permission.sendEvent).toBeTruthy();
		expect(permission.subscribeEvent).toBeTruthy();
		expect(permission.maxEventPriority).toEqual(0);
		// priority のみ指定
		const priorityOnly = {
			maxEventPriority: 3,
		};
		permission = PlayTokenPermission.generate(priorityOnly);
		expect(permission.writeTick).toBeFalsy();
		expect(permission.readTick).toBeFalsy();
		expect(permission.subscribeTick).toBeFalsy();
		expect(permission.sendEvent).toBeFalsy();
		expect(permission.subscribeEvent).toBeFalsy();
		expect(permission.maxEventPriority).toEqual(3);
		// すべて指定
		const all = {
			writeTick: true,
			readTick: true,
			subscribeTick: true,
			sendEvent: true,
			subscribeEvent: true,
			maxEventPriority: 3,
		};
		permission = PlayTokenPermission.generate(all);
		expect(permission.writeTick).toBeTruthy();
		expect(permission.readTick).toBeTruthy();
		expect(permission.subscribeTick).toBeTruthy();
		expect(permission.sendEvent).toBeTruthy();
		expect(permission.subscribeEvent).toBeTruthy();
		expect(permission.maxEventPriority).toEqual(3);
	});

	it("test-generate-from-string", () => {
		// 権限なし
		let permission: PlayTokenPermission = PlayTokenPermission.generate("000");
		expect(permission.writeTick).toBeFalsy();
		expect(permission.readTick).toBeFalsy();
		expect(permission.subscribeTick).toBeFalsy();
		expect(permission.sendEvent).toBeFalsy();
		expect(permission.subscribeEvent).toBeFalsy();
		expect(permission.maxEventPriority).toEqual(0);
		// 有効:subscribeEvent
		permission = PlayTokenPermission.generate("001");
		expect(permission.writeTick).toBeFalsy();
		expect(permission.readTick).toBeFalsy();
		expect(permission.subscribeTick).toBeFalsy();
		expect(permission.sendEvent).toBeFalsy();
		expect(permission.subscribeEvent).toBeTruthy();
		expect(permission.maxEventPriority).toEqual(0);
		// 有効:writeTick
		permission = PlayTokenPermission.generate("010");
		expect(permission.writeTick).toBeTruthy();
		expect(permission.readTick).toBeFalsy();
		expect(permission.subscribeTick).toBeFalsy();
		expect(permission.sendEvent).toBeFalsy();
		expect(permission.subscribeEvent).toBeFalsy();
		expect(permission.maxEventPriority).toEqual(0);
		// 有効:writeTick, subscribeEvent
		permission = PlayTokenPermission.generate("011");
		expect(permission.writeTick).toBeTruthy();
		expect(permission.readTick).toBeFalsy();
		expect(permission.subscribeTick).toBeFalsy();
		expect(permission.sendEvent).toBeFalsy();
		expect(permission.subscribeEvent).toBeTruthy();
		expect(permission.maxEventPriority).toEqual(0);
		// 有効:sendEvent, priority=2
		permission = PlayTokenPermission.generate("020");
		expect(permission.writeTick).toBeFalsy();
		expect(permission.readTick).toBeFalsy();
		expect(permission.subscribeTick).toBeFalsy();
		expect(permission.sendEvent).toBeTruthy();
		expect(permission.subscribeEvent).toBeFalsy();
		expect(permission.maxEventPriority).toEqual(2);
		// 有効:sendEvent, subscribeEvent, priority=2
		permission = PlayTokenPermission.generate("021");
		expect(permission.writeTick).toBeFalsy();
		expect(permission.readTick).toBeFalsy();
		expect(permission.subscribeTick).toBeFalsy();
		expect(permission.sendEvent).toBeTruthy();
		expect(permission.subscribeEvent).toBeTruthy();
		expect(permission.maxEventPriority).toEqual(2);
		// 有効:sendEvent, priority=1
		permission = PlayTokenPermission.generate("040");
		expect(permission.writeTick).toBeFalsy();
		expect(permission.readTick).toBeFalsy();
		expect(permission.subscribeTick).toBeFalsy();
		expect(permission.sendEvent).toBeTruthy();
		expect(permission.subscribeEvent).toBeFalsy();
		expect(permission.maxEventPriority).toEqual(1);
		// 有効:sendEvent, subscribeEvent, priority=1
		permission = PlayTokenPermission.generate("041");
		expect(permission.writeTick).toBeFalsy();
		expect(permission.readTick).toBeFalsy();
		expect(permission.subscribeTick).toBeFalsy();
		expect(permission.sendEvent).toBeTruthy();
		expect(permission.subscribeEvent).toBeTruthy();
		expect(permission.maxEventPriority).toEqual(1);
		// 有効:readTick, subscribeTick
		permission = PlayTokenPermission.generate("100");
		expect(permission.writeTick).toBeFalsy();
		expect(permission.readTick).toBeTruthy();
		expect(permission.subscribeTick).toBeTruthy();
		expect(permission.sendEvent).toBeFalsy();
		expect(permission.subscribeEvent).toBeFalsy();
		expect(permission.maxEventPriority).toEqual(0);
		// 有効:readTick, subscribeTick, subscribeEvent
		permission = PlayTokenPermission.generate("101");
		expect(permission.writeTick).toBeFalsy();
		expect(permission.readTick).toBeTruthy();
		expect(permission.subscribeTick).toBeTruthy();
		expect(permission.sendEvent).toBeFalsy();
		expect(permission.subscribeEvent).toBeTruthy();
		expect(permission.maxEventPriority).toEqual(0);
		// 有効:readTick, subscribeTick, writeTick
		permission = PlayTokenPermission.generate("110");
		expect(permission.writeTick).toBeTruthy();
		expect(permission.readTick).toBeTruthy();
		expect(permission.subscribeTick).toBeTruthy();
		expect(permission.sendEvent).toBeFalsy();
		expect(permission.subscribeEvent).toBeFalsy();
		expect(permission.maxEventPriority).toEqual(0);
		// 有効:readTick, subscribeTick, writeTick, subscribeEvent
		permission = PlayTokenPermission.generate("111");
		expect(permission.writeTick).toBeTruthy();
		expect(permission.readTick).toBeTruthy();
		expect(permission.subscribeTick).toBeTruthy();
		expect(permission.sendEvent).toBeFalsy();
		expect(permission.subscribeEvent).toBeTruthy();
		expect(permission.maxEventPriority).toEqual(0);
		// 有効:readTick, subscribeTick, sendEvent, priority=2
		permission = PlayTokenPermission.generate("120");
		expect(permission.writeTick).toBeFalsy();
		expect(permission.readTick).toBeTruthy();
		expect(permission.subscribeTick).toBeTruthy();
		expect(permission.sendEvent).toBeTruthy();
		expect(permission.subscribeEvent).toBeFalsy();
		expect(permission.maxEventPriority).toEqual(2);
		// 有効:readTick, subscribeTick, sendEvent, subscribeEvent, priority=2
		permission = PlayTokenPermission.generate("121");
		expect(permission.writeTick).toBeFalsy();
		expect(permission.readTick).toBeTruthy();
		expect(permission.subscribeTick).toBeTruthy();
		expect(permission.sendEvent).toBeTruthy();
		expect(permission.subscribeEvent).toBeTruthy();
		expect(permission.maxEventPriority).toEqual(2);
		// 有効:readTick, subscribeTick, sendEvent, priority=1
		permission = PlayTokenPermission.generate("140");
		expect(permission.writeTick).toBeFalsy();
		expect(permission.readTick).toBeTruthy();
		expect(permission.subscribeTick).toBeTruthy();
		expect(permission.sendEvent).toBeTruthy();
		expect(permission.subscribeEvent).toBeFalsy();
		expect(permission.maxEventPriority).toEqual(1);
		// 有効:readTick, subscribeTick, sendEvent, subscribeEvent, priority=1
		permission = PlayTokenPermission.generate("141");
		expect(permission.writeTick).toBeFalsy();
		expect(permission.readTick).toBeTruthy();
		expect(permission.subscribeTick).toBeTruthy();
		expect(permission.sendEvent).toBeTruthy();
		expect(permission.subscribeEvent).toBeTruthy();
		expect(permission.maxEventPriority).toEqual(1);
		// 存在しないフラグなので readTickが付与されない
		permission = PlayTokenPermission.generate("200");
		expect(permission.writeTick).toBeFalsy();
		expect(permission.readTick).toBeFalsy();
		expect(permission.subscribeTick).toBeFalsy();
		expect(permission.sendEvent).toBeFalsy();
		expect(permission.subscribeEvent).toBeFalsy();
		expect(permission.maxEventPriority).toEqual(0);
	});

	it("test-toJSON", () => {
		const all = {
			writeTick: true,
			readTick: true,
			subscribeTick: true,
			sendEvent: true,
			subscribeEvent: true,
			maxEventPriority: 3,
		};
		const permission: PlayTokenPermission = PlayTokenPermission.generate(all);
		const json = permission.toJSON();
		expect(permission.writeTick).toBeTruthy();
		expect(permission.readTick).toBeTruthy();
		expect(permission.subscribeTick).toBeTruthy();
		expect(permission.sendEvent).toBeTruthy();
		expect(permission.subscribeEvent).toBeTruthy();
		expect(permission.maxEventPriority).toEqual(3);
		expect(permission.writeTick).toEqual(json.writeTick);
		expect(permission.readTick).toEqual(json.readTick);
		expect(permission.subscribeTick).toEqual(json.subscribeTick);
		expect(permission.sendEvent).toEqual(json.sendEvent);
		expect(permission.subscribeEvent).toEqual(json.subscribeEvent);
		expect(permission.maxEventPriority).toEqual(json.maxEventPriority);
	});

	it("test-throw-Error", () => {
		// 引数が不正
		expect(() => PlayTokenPermission.generate(null)).toThrow();
		// priorityが範囲外
		expect(() =>
			PlayTokenPermission.generate({
				maxEventPriority: -1,
			}),
		).toThrow();
		expect(() =>
			PlayTokenPermission.generate({
				maxEventPriority: 4,
			}),
		).toThrow();
	});
});
