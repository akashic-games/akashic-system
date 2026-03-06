import * as dt from "@akashic/server-engine-data-types";
import { PlayTokenHolder } from "./PlayTokenHolder";
import { PlayTokenStore } from "./PlayTokenStore";

describe("PlayTokenStore", () => {
	const ptPermission = {
		writeTick: false,
		readTick: false,
		subscribeTick: false,
		sendEvent: false,
		subscribeEvent: false,
		maxEventPriority: 1,
	};

	function createPlayTokenHolder(id: string, sessionId: string, playId: string, user?: string, parentId?: string): PlayTokenHolder {
		const token = new dt.PlayToken({
			id,
			playId,
			value: "dummy",
			hash: "dummy",
			expire: new Date(),
			permission: ptPermission,
			meta: user ? { userId: user } : {},
		});
		return new PlayTokenHolder(token, sessionId, parentId);
	}

	it("can construct", () => {
		const store = new PlayTokenStore();
		expect(store.count()).toBe(0);
	});

	it("can add/delete play token holder", () => {
		const store = new PlayTokenStore();
		const tokens = [
			createPlayTokenHolder("0", "session0", "play0", "user0"),
			createPlayTokenHolder("1", "session1", "play1", "user1"),
			createPlayTokenHolder("2", "session2", "play2", "user2"),
		];
		tokens.forEach((token) => {
			store.add(token);
		});
		expect(store.count()).toBe(3);
		expect(store.get("1")).toEqual(tokens[1]);
		store.delete("0");
		expect(store.count()).toBe(2);
		expect(store.get("0")).toBeFalsy();
		store.clear();
		expect(store.count()).toBe(0);
	});

	it("can delete by session ID", () => {
		const store = new PlayTokenStore();
		const tokens = [
			createPlayTokenHolder("0", "session0", "play0", "user0"),
			createPlayTokenHolder("1", "session0", "play1", "user1"),
			createPlayTokenHolder("2", "sessionA", "play2", "user2"),
			createPlayTokenHolder("3", "sessionA", "play3", "user3"),
			createPlayTokenHolder("4", "session4", "play4", "user4"),
		];
		tokens.forEach((token) => {
			store.add(token);
		});
		store.deleteBySession("sessionA");
		expect(store.count()).toBe(3);
		expect(store.get("0")).toEqual(tokens[0]);
		expect(store.get("1")).toEqual(tokens[1]);
		expect(store.get("2")).toBeFalsy();
		expect(store.get("3")).toBeFalsy();
		expect(store.get("4")).toEqual(tokens[4]);
	});

	it("can get by session ID", () => {
		const store = new PlayTokenStore();
		const tokens = [
			createPlayTokenHolder("0", "session0", "play0", "user0"),
			createPlayTokenHolder("1", "session0", "play1", "user1"),
			createPlayTokenHolder("2", "sessionA", "play2", "user2"),
			createPlayTokenHolder("3", "sessionA", "play3", "user3"),
			createPlayTokenHolder("4", "session2", "play4", "user4"),
		];
		tokens.forEach((token) => {
			store.add(token);
		});
		const holders = store.getBySession("sessionA");
		expect(holders.length).toBe(2);
		expect(holders[0]).toEqual(tokens[2]);
		expect(holders[1]).toEqual(tokens[3]);
		const toBeEmpty = store.getBySession("sessionB");
		expect(toBeEmpty.length).toBe(0);
	});

	it("can get by parent play ID", () => {
		const store = new PlayTokenStore();
		const tokens = [
			createPlayTokenHolder("0", "session0", "play0", "user0", "parent0"),
			createPlayTokenHolder("1", "session1", "play1", "user1"),
			createPlayTokenHolder("2", "session2", "play2", "user2", "parentA"),
			createPlayTokenHolder("3", "session3", "play3", "user3", "parentA"),
			createPlayTokenHolder("4", "session4", "play4", "user4", "parent4"),
		];
		tokens.forEach((token) => {
			store.add(token);
		});
		const holders = store.getByParent("parentA");
		expect(holders.length).toBe(2);
		expect(holders[0]).toEqual(tokens[2]);
		expect(holders[1]).toEqual(tokens[3]);
		const toBeEmpty = store.getByParent("parentB");
		expect(toBeEmpty.length).toBe(0);
	});

	it("can get by play ID", () => {
		const store = new PlayTokenStore();
		const tokens = [
			createPlayTokenHolder("0", "session0", "play0", "user0"),
			createPlayTokenHolder("1", "session1", "play1", "user1"),
			createPlayTokenHolder("2", "session2", "playA", "user2"),
			createPlayTokenHolder("3", "session3", "playA", "user3"),
			createPlayTokenHolder("4", "session4", "play4", "user4"),
		];
		tokens.forEach((token) => {
			store.add(token);
		});
		const holders = store.getByPlay("playA");
		expect(holders.length).toBe(2);
		expect(holders[0]).toEqual(tokens[2]);
		expect(holders[1]).toEqual(tokens[3]);
		const toBeEmpty = store.getByPlay("playB");
		expect(toBeEmpty.length).toBe(0);
	});

	it("can get by user ID", () => {
		const store = new PlayTokenStore();
		const tokens = [
			createPlayTokenHolder("0", "session0", "play0", "user0"),
			createPlayTokenHolder("1", "session1", "play1"),
			createPlayTokenHolder("2", "session2", "playA", "userA"),
			createPlayTokenHolder("3", "session3", "playA", "userA"),
			createPlayTokenHolder("4", "session4", "play4", "user4"),
		];
		tokens.forEach((token) => {
			store.add(token);
		});
		const holdersA = store.getByUser("userA");
		expect(holdersA.length).toBe(2);
		expect(holdersA[0]).toEqual(tokens[2]);
		expect(holdersA[1]).toEqual(tokens[3]);
		const toBeEmpty = store.getByUser("userB");
		expect(toBeEmpty.length).toBe(0);
	});
});
