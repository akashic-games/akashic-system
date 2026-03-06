import PlayToken = require("./PlayToken");
import PlayTokenLike = require("./PlayTokenLike");
import { PlayTokenPermission } from "./PlayTokenPermission";
import { PlayTokenPermissionLike } from "./PlayTokenPermissionLike";

describe("PlayToken", () => {
	it("test-constructor", () => {
		const data: PlayTokenLike = {
			playId: "1",
			value: "hoge",
			hash: "123",
			expire: new Date(),
			permission: PlayTokenPermission.generate("121"),
			meta: {
				userId: "2",
				premiumUser: true,
			},
		};
		const playToken = new PlayToken(data);
		expect(playToken.playId).toEqual(data.playId);
		expect(playToken.value).toEqual(data.value);
		expect(playToken.hash).toEqual(data.hash);
		expect(playToken.expire.getTime()).toEqual(data.expire.getTime());
		expect(playToken.id).toBeUndefined();
		expect(playToken.permission).toEqual(PlayTokenPermission.generate(data.permission));
		expect(playToken.meta).toBe(data.meta);
	});
	it("test-playToken-update", () => {
		const permission120 = PlayTokenPermission.generate("120");
		const permissionNoAll = PlayTokenPermission.generate({});
		const data: PlayTokenLike = {
			playId: "1",
			value: "hoge",
			hash: "123",
			expire: new Date(),
			permission: PlayTokenPermission.generate("100"),
			meta: {
				userId: "2",
				premiumUser: true,
			},
		};
		let playToken = new PlayToken(data);
		/**
		 * 文字列指定でトークン権限更新
		 */
		playToken = playToken.update({ permission: "120" });
		expect(playToken.permission).toEqual(permission120);
		playToken = playToken.update({});
		expect(playToken.permission).toEqual(permission120);
		data.permission = PlayTokenPermission.generate("");
		playToken = new PlayToken(data);
		expect(playToken.permission).toEqual(PlayTokenPermission.generate(data.permission));
		/**
		 * object指定でトークン権限更新
		 */
		const tickOnly: PlayTokenPermissionLike = {
			writeTick: true,
			readTick: true,
			subscribeTick: true,
			sendEvent: false,
			subscribeEvent: false,
			maxEventPriority: 0,
		};
		playToken = playToken.update({ permission: tickOnly });
		expect(playToken.permission).toEqual(PlayTokenPermission.generate(tickOnly));
		playToken = playToken.update({});
		expect(playToken.permission).toEqual(PlayTokenPermission.generate(tickOnly));
		playToken = playToken.update({ permission: {} });
		expect(playToken.permission).toEqual(permissionNoAll);
	});
	it("test-constructor-with-id", () => {
		const data: PlayTokenLike = {
			playId: "1",
			value: "hoge",
			hash: "123",
			expire: new Date(),
			permission: PlayTokenPermission.generate("010"),
			meta: {},
		};
		const playToken = new PlayToken(data, "12345");
		expect(playToken.playId).toEqual(data.playId);
		expect(playToken.value).toEqual(data.value);
		expect(playToken.hash).toEqual(data.hash);
		expect(playToken.expire.getTime()).toEqual(data.expire.getTime());
		expect(playToken.id).toEqual("12345");
		expect(playToken.meta).not.toBeNull();
		expect(playToken.permission).toEqual(PlayTokenPermission.generate(data.permission));
	});
	it("test-constructor-with-meta", () => {
		const data: PlayTokenLike = {
			playId: "1",
			value: "hoge",
			hash: "123",
			expire: new Date(),
			permission: PlayTokenPermission.generate("010"),
			meta: { userId: "0" },
		};
		const playToken = new PlayToken(data, undefined, { userId: "3" });
		expect(playToken.playId).toEqual(data.playId);
		expect(playToken.value).toEqual(data.value);
		expect(playToken.hash).toEqual(data.hash);
		expect(playToken.expire.getTime()).toEqual(data.expire.getTime());
		expect(playToken.id).toBeUndefined();
		expect(playToken.meta.userId).toEqual("3");
		expect(playToken.permission).toEqual(PlayTokenPermission.generate(data.permission));
	});
	it("test-constructor-with-id,meta", () => {
		const data: PlayTokenLike = {
			playId: "1",
			value: "hoge",
			hash: "123",
			expire: new Date(),
			permission: PlayTokenPermission.generate("010"),
			meta: { userId: "0" },
		};
		const playToken = new PlayToken(data, "12345", { userId: "3" });
		expect(playToken.playId).toEqual(data.playId);
		expect(playToken.value).toEqual(data.value);
		expect(playToken.hash).toEqual(data.hash);
		expect(playToken.expire.getTime()).toEqual(data.expire.getTime());
		expect(playToken.id).toEqual("12345");
		expect(playToken.meta.userId).toEqual("3");
		expect(playToken.permission).toEqual(PlayTokenPermission.generate(data.permission));
	});
	it("test-toJson", () => {
		const permission = PlayTokenPermission.generate("000");
		const data: PlayTokenLike = {
			playId: "1",
			value: "hoge",
			hash: "123",
			expire: new Date(),
			permission,
			meta: {
				userId: "2",
			},
		};
		let playToken = new PlayToken(data, "12345");
		let result = playToken.toJSON();
		expect(result.playId).toEqual(data.playId);
		expect(result.value).toEqual(data.value);
		expect(result.hash).toEqual(data.hash);
		expect(result.expire.getTime()).toEqual(data.expire.getTime());
		expect(result.id).toEqual("12345");
		expect(result.permission).toEqual(permission.toJSON());
		expect(result.meta).toBe(data.meta);
		const data2: PlayTokenLike = {
			playId: "1",
			value: "hoge",
			hash: "123",
			expire: new Date(),
			permission,
			meta: {
				userId: "2",
			},
		};
		playToken = new PlayToken(data2);
		result = playToken.toJSON();
		expect(result.playId).toEqual(data2.playId);
		expect(result.value).toEqual(data2.value);
		expect(result.hash).toEqual(data2.hash);
		expect(result.expire.getTime()).toEqual(data2.expire.getTime());
		expect(result.permission).toEqual(permission.toJSON());
		expect(result.meta).toBe(data2.meta);
	});
	it("test-fromObject", () => {
		const permission = PlayTokenPermission.generate("000");
		let playToken: PlayToken;
		const data: PlayTokenLike = {
			id: "12345",
			playId: "1",
			value: "hoge",
			hash: "123",
			expire: new Date(),
			permission,
			meta: {
				userId: "2",
			},
		};
		playToken = PlayToken.fromObject(data);
		expect(playToken.id).toEqual(data.id);
		expect(playToken.playId).toEqual(data.playId);
		expect(playToken.value).toEqual(data.value);
		expect(playToken.hash).toEqual(data.hash);
		expect(playToken.expire.getTime()).toEqual(data.expire.getTime());
		expect(playToken.permission).toEqual(PlayTokenPermission.generate(data.permission));
		expect(playToken.meta).toEqual(data.meta);
		const data2 = {
			playId: "1",
			value: "hoge",
			hash: "123",
			expire: "2015-06-12T12:12:12+09:00",
			permission,
			meta: {
				userId: "2",
			},
		};
		playToken = PlayToken.fromObject(data2);
		expect(playToken.id).toBeUndefined();
		expect(playToken.playId).toEqual(data2.playId);
		expect(playToken.value).toEqual(data2.value);
		expect(playToken.expire.getTime()).toEqual(new Date(data2.expire).getTime());
		expect(playToken.permission).toEqual(data2.permission);
		expect(playToken.meta).toEqual(data2.meta);
		playToken = PlayToken.fromObject(playToken);
		expect(playToken.id).toBeUndefined();
		expect(playToken.playId).toEqual(data2.playId);
		expect(playToken.value).toEqual(data2.value);
		expect(playToken.expire.getTime()).toEqual(new Date(data2.expire).getTime());
		expect(playToken.permission).toEqual(data2.permission);
		expect(playToken.meta).toEqual(data2.meta);
	});
	it("test-fromObject-error", () => {
		// playId が bigInt に cast できない
		expect(() =>
			PlayToken.fromObject({
				playId() {
					return 0;
				},
				value: "hoge",
				expire: "2015-06-12T12:12:12+09:00",
				permission: "000",
				meta: {},
			}),
		).toThrow();
		// value が string に cast できない
		expect(() =>
			PlayToken.fromObject({
				id: "123",
				playId: "3",
				value: 12222,
				expire: "2015-06-12T12:12:12+09:00",
				permission: "000",
				meta: {},
			}),
		).toThrow();
		// expire が Date として不正
		expect(() =>
			PlayToken.fromObject({
				playId: "3",
				value: "hoge",
				expire: "invalid date string",
				permission: "000",
				meta: {},
			}),
		).toThrow();
		// id が 整数でない
		expect(() =>
			PlayToken.fromObject({
				id: 3.1415,
				playId: "3",
				value: "hoge",
				expire: "2015-06-12T12:12:12+09:00",
				permission: "000",
				meta: {},
			}),
		).toThrow();
		// expire が Date として不正
		expect(() =>
			PlayToken.fromObject({
				playId: "3",
				value: "hoge",
				expire: {},
				permission: "000",
				meta: {},
			}),
		).toThrow();
		// permission が string や object ではない
		expect(() =>
			PlayToken.fromObject({
				playId: "3",
				value: "hoge",
				expire: "2015-06-12T12:12:12+09:00",
				permission: 1,
				meta: {},
			}),
		).toThrow();
		// 引数がオブジェクトじゃない
		expect(() => PlayToken.fromObject(null)).toThrow();
	});
	it("test-generate", () => {
		const expire = new Date();
		const tickOnly: PlayTokenPermissionLike = {
			writeTick: true,
			readTick: true,
			subscribeTick: true,
			sendEvent: false,
			subscribeEvent: false,
			maxEventPriority: 0,
		};
		const permissionObj = PlayTokenPermission.generate(tickOnly);
		// metaなし
		let playToken = PlayToken.generatePlayToken("111", "3141592ejeorwajofvfjao3ri2", expire, tickOnly);
		expect(playToken.id).toBeUndefined();
		expect(playToken.playId).toEqual("111");
		expect(playToken.value.length).toEqual(64); // 現行のハッシュ長は256bit
		expect(playToken.expire.getTime()).toEqual(expire.getTime());
		expect(playToken.permission).toEqual(permissionObj);
		expect(playToken.meta).toBeUndefined();
		// meta あり
		playToken = PlayToken.generatePlayToken("111", "3141592ejeorwajofvfjao3ri2", expire, tickOnly, { userId: "100" });
		expect(playToken.id).toBeUndefined();
		expect(playToken.playId).toEqual("111");
		expect(playToken.value.length).toEqual(64); // 現行のハッシュ長は256bit
		expect(playToken.expire.getTime()).toEqual(expire.getTime());
		expect(playToken.permission).toEqual(permissionObj);
		expect(playToken.meta.userId).toEqual("100");
		/**
		 * エラーケース
		 */
		expect(() => PlayToken.generatePlayToken("111", "shortstr", expire, tickOnly)).toThrow();
		expect(() => PlayToken.generatePlayToken("111", [] as any, expire, tickOnly)).toThrow();
	});
});
