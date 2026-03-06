import { PlaylogStoreFacade } from "./PlaylogStoreFacade";
import { MemoryActiveStore } from "./MemoryActiveStore";
import { MemoryArchiveStore } from "./PlaylogArchiveStore/MemoryArchiveStore";
import { MemoryMetadataStore } from "./PlaylogMetadataStore/MemoryMetadataStore";
import type { Tick } from "@akashic/playlog";
import type { StartPoint } from "@akashic/amflow";
import { IPlaylogLock } from "./PlaylogDatabase";

class DummyPlaylogLock implements IPlaylogLock {
	public called = 0;

	async withPlaylogLock<T>(_: string, inLock: () => Promise<T>): Promise<T> {
		this.called++;
		return inLock();
	}

	reset() {
		this.called = 0;
	}
}

describe("PlaylogStoreFacade", () => {
	const tick1: Tick = [1];
	const tick2: Tick = [2];
	const startPoint1: StartPoint = {
		frame: 1,
		timestamp: 12345678,
		data: "data",
	};

	describe("書き込みのテスト", () => {
		it("putTickでtickをActiveStoreに書き込み出来る", async () => {
			const playId = "124378091";
			const activeStore = new MemoryActiveStore();
			const archiveStore = new MemoryArchiveStore();
			const metadataStore = new MemoryMetadataStore();
			const lock = new DummyPlaylogLock();
			const playlogStore = new PlaylogStoreFacade({
				activeStore,
				archiveStore,
				metadataStore,
				lock,
			});

			await playlogStore.putTick(playId, tick1);
			expect(activeStore.ticks.get(playId)?.get(1)).toBeTruthy();
		});

		it("アーカイブ作成済みplayに対してputTickすると失敗し、何も書き込まれない", async () => {
			const playId = "124378092";
			const activeStore = new MemoryActiveStore();
			const archiveStore = new MemoryArchiveStore();
			const metadataStore = new MemoryMetadataStore();
			const lock = new DummyPlaylogLock();
			const playlogStore = new PlaylogStoreFacade({
				activeStore,
				archiveStore,
				metadataStore,
				lock,
			});

			await metadataStore.setHasArchived(playId, true);
			await expect(playlogStore.putTick(playId, tick1)).rejects.toThrow("アーカイブ作成済みのplay");
			expect(activeStore.ticks.size).toBe(0);
		});

		it("putStartPointでstartPointをActiveStoreに書き込み出来る", async () => {
			const playId = "124378093";
			const activeStore = new MemoryActiveStore();
			const archiveStore = new MemoryArchiveStore();
			const metadataStore = new MemoryMetadataStore();
			const lock = new DummyPlaylogLock();
			const playlogStore = new PlaylogStoreFacade({
				activeStore,
				archiveStore,
				metadataStore,
				lock,
			});

			await playlogStore.putStartPoint(playId, startPoint1);
			expect(activeStore.startPoints.get(playId)?.get(1)).toBeTruthy();
		});

		it("アーカイブ作成済みplayに対してputStartPointすると失敗し、何も書き込まれない", async () => {
			const playId = "124378094";
			const activeStore = new MemoryActiveStore();
			const archiveStore = new MemoryArchiveStore();
			const metadataStore = new MemoryMetadataStore();
			const lock = new DummyPlaylogLock();
			const playlogStore = new PlaylogStoreFacade({
				activeStore,
				archiveStore,
				metadataStore,
				lock,
			});

			await metadataStore.setHasArchived(playId, true);
			await expect(playlogStore.putStartPoint(playId, startPoint1)).rejects.toThrow("アーカイブ作成済みのplay");
			expect(activeStore.startPoints.size).toBe(0);
		});

		it("updateTickでActiveStoreのtickを更新できる", async () => {
			const playId = "124378095";
			const activeStore = new MemoryActiveStore();
			const archiveStore = new MemoryArchiveStore();
			const metadataStore = new MemoryMetadataStore();
			const lock = new DummyPlaylogLock();
			const playlogStore = new PlaylogStoreFacade({
				activeStore,
				archiveStore,
				metadataStore,
				lock,
			});

			await activeStore.putTick(playId, tick2);
			const newTick: Tick = [tick2[0], [[0, 1, null]]];
			await playlogStore.updateTick(playId, newTick);
			const tick = activeStore.ticks.get(playId)?.get(2);
			const event = tick ? tick[1] : undefined;
			expect(event).toBeTruthy();
		});

		it("アーカイブ作成済みplayに対してupdateTickすると失敗し、何も書き込まれない", async () => {
			const playId = "124378096";
			const activeStore = new MemoryActiveStore();
			const archiveStore = new MemoryArchiveStore();
			const metadataStore = new MemoryMetadataStore();
			const lock = new DummyPlaylogLock();
			const playlogStore = new PlaylogStoreFacade({
				activeStore,
				archiveStore,
				metadataStore,
				lock,
			});

			await activeStore.putTick(playId, tick2);
			await metadataStore.setHasArchived(playId, true);
			const newTick: Tick = [tick2[0], [[0, 1, null]]];
			await expect(playlogStore.updateTick(playId, newTick)).rejects.toThrow("アーカイブ作成済みのplay");
			const tick = activeStore.ticks.get(playId)?.get(2);
			const event = tick ? tick[1] : undefined;
			expect(event).toBeFalsy();
		});
	});
	describe("読み込みのテスト", () => {
		it("getTickでtickを読み込める", async () => {
			const playId = "124378097";
			const activeStore = new MemoryActiveStore();
			const archiveStore = new MemoryArchiveStore();
			const metadataStore = new MemoryMetadataStore();
			const lock = new DummyPlaylogLock();
			const playlogStore = new PlaylogStoreFacade({
				activeStore,
				archiveStore,
				metadataStore,
				lock,
			});

			await activeStore.putTick(playId, tick2);
			const tick = (await playlogStore.getTick(playId, 2)) as Tick;
			expect(tick).not.toBeNull();
			expect(tick[0]).toBe(2);
			expect(lock.called).toBe(0);
		});

		it("getTickでtickを読み込める(該当tickが無い場合)", async () => {
			const playId = "124378098";
			const activeStore = new MemoryActiveStore();
			const archiveStore = new MemoryArchiveStore();
			const metadataStore = new MemoryMetadataStore();
			const lock = new DummyPlaylogLock();
			const playlogStore = new PlaylogStoreFacade({
				activeStore,
				archiveStore,
				metadataStore,
				lock,
			});

			const tick = (await playlogStore.getTick(playId, 2)) as Tick;
			expect(tick).toBeNull();
			expect(lock.called).toBe(0);
		});

		it("getTickでアーカイブにしか無い場合はactiveに戻してからtickが読み込まれる", async () => {
			const playId = "124378099";
			const activeStore = new MemoryActiveStore();
			const archiveStore = new MemoryArchiveStore();
			const metadataStore = new MemoryMetadataStore();
			const lock = new DummyPlaylogLock();
			const playlogStore = new PlaylogStoreFacade({
				activeStore,
				archiveStore,
				metadataStore,
				lock,
			});

			await metadataStore.setShouldGetFromArchive(playId, true);
			await archiveStore.store(playId, { original: [tick1, tick2], excludedIgnorable: [tick1, tick2] }, [startPoint1]);

			const tick = (await playlogStore.getTick(playId, 2)) as Tick;
			expect(tick).not.toBeNull();
			expect(tick[0]).toBe(2);

			// ticks
			const activeStoreTicks = Array.from(activeStore.ticks.get(playId)?.values() ?? []);
			expect(activeStoreTicks).toEqual([tick1, tick2]);
			const activeStoreExcludedIgnorableTicks = Array.from(activeStore.excludedIgnorableTicks.get(playId)?.values() ?? []);
			expect(activeStoreExcludedIgnorableTicks).toEqual([tick1, tick2]);
			// start points
			const activeStoreStartPoints = Array.from(activeStore.startPoints.get(playId)?.values() ?? []);
			expect(activeStoreStartPoints).toEqual([startPoint1]);
			// lock
			expect(lock.called).toBe(1);
			expect(await metadataStore.shouldGetFromArchive(playId)).toBe(false);
		});

		it("getTicksでtickの配列を読み込める", async () => {
			const playId = "124378100";
			const activeStore = new MemoryActiveStore();
			const archiveStore = new MemoryArchiveStore();
			const metadataStore = new MemoryMetadataStore();
			const lock = new DummyPlaylogLock();
			const playlogStore = new PlaylogStoreFacade({
				activeStore,
				archiveStore,
				metadataStore,
				lock,
			});

			await activeStore.putTick(playId, tick2);
			const ticks = await playlogStore.getTicks({ playId, limit: 10 });
			expect(ticks[0][0]).toBe(2);
			expect(lock.called).toBe(0);
		});

		it("getTicksでアーカイブにしか無い場合はactiveに戻してからtick一覧が読み込まれる", async () => {
			const playId = "124378101";
			const activeStore = new MemoryActiveStore();
			const archiveStore = new MemoryArchiveStore();
			const metadataStore = new MemoryMetadataStore();
			const lock = new DummyPlaylogLock();
			const playlogStore = new PlaylogStoreFacade({
				activeStore,
				archiveStore,
				metadataStore,
				lock,
			});

			await metadataStore.setShouldGetFromArchive(playId, true);
			await archiveStore.store(playId, { original: [tick1, tick2], excludedIgnorable: [tick1, tick2] }, [startPoint1]);
			const tick = await playlogStore.getTicks({ playId, limit: 10 });
			expect(tick).not.toBeNull();
			expect(tick[0][0]).toBe(1);
			// ticks
			const activeStoreTicks = Array.from(activeStore.ticks.get(playId)?.values() ?? []);
			expect(activeStoreTicks).toEqual([tick1, tick2]);
			const activeStoreExcludedIgnorableTicks = Array.from(activeStore.excludedIgnorableTicks.get(playId)?.values() ?? []);
			expect(activeStoreExcludedIgnorableTicks).toEqual([tick1, tick2]);
			// start points
			const activeStoreStartPoints = Array.from(activeStore.startPoints.get(playId)?.values() ?? []);
			expect(activeStoreStartPoints).toEqual([startPoint1]);
			// lock
			expect(lock.called).toBe(1);
			expect(await metadataStore.shouldGetFromArchive(playId)).toBe(false);
		});

		it("アーカイブとmetadataが不一致を起こしていたらエラーになる", async () => {
			const playId = "124378102";
			const activeStore = new MemoryActiveStore();
			const archiveStore = new MemoryArchiveStore();
			const metadataStore = new MemoryMetadataStore();
			const lock = new DummyPlaylogLock();
			const playlogStore = new PlaylogStoreFacade({
				activeStore,
				archiveStore,
				metadataStore,
				lock,
			});

			await metadataStore.setShouldGetFromArchive(playId, true);
			await expect(playlogStore.getTicks({ playId, limit: 10 })).rejects.toThrow(
				/アーカイブをリストアしようとしましたがデータがありません/,
			);
		});

		it("getTicksRawでtickの配列を読み込める", async () => {
			const playId = "124378103";
			const activeStore = new MemoryActiveStore();
			const archiveStore = new MemoryArchiveStore();
			const metadataStore = new MemoryMetadataStore();
			const lock = new DummyPlaylogLock();
			const playlogStore = new PlaylogStoreFacade({
				activeStore,
				archiveStore,
				metadataStore,
				lock,
			});

			await activeStore.putTick(playId, tick2);
			const ticks = await playlogStore.getTicksRaw({ playId, limit: 10 });
			expect(ticks[0][0]).toBe(2);
			expect(lock.called).toBe(0);
		});

		it("getTicksRawでアーカイブにしか無い場合はactiveに戻してからtick一覧が読み込まれる", async () => {
			const playId = "124378104";
			const activeStore = new MemoryActiveStore();
			const archiveStore = new MemoryArchiveStore();
			const metadataStore = new MemoryMetadataStore();
			const lock = new DummyPlaylogLock();
			const playlogStore = new PlaylogStoreFacade({
				activeStore,
				archiveStore,
				metadataStore,
				lock,
			});

			await metadataStore.setShouldGetFromArchive(playId, true);
			await archiveStore.store(playId, { original: [tick1, tick2], excludedIgnorable: [tick1, tick2] }, [startPoint1]);
			const tick = await playlogStore.getTicksRaw({ playId, limit: 10 });
			expect(tick).not.toBeNull();
			expect(tick[0][0]).toBe(1);

			// ticks
			const activeStoreTicks = Array.from(activeStore.ticks.get(playId)?.values() ?? []);
			expect(activeStoreTicks).toEqual([tick1, tick2]);
			const activeStoreExcludedIgnorableTicks = Array.from(activeStore.excludedIgnorableTicks.get(playId)?.values() ?? []);
			expect(activeStoreExcludedIgnorableTicks).toEqual([tick1, tick2]);
			// start points
			const activeStoreStartPoints = Array.from(activeStore.startPoints.get(playId)?.values() ?? []);
			expect(activeStoreStartPoints).toEqual([startPoint1]);

			expect(lock.called).toBe(1);
			expect(await metadataStore.shouldGetFromArchive(playId)).toBe(false);
		});

		it("getStartPointでstartPointを読み込める", async () => {
			const playId = "124378105";
			const activeStore = new MemoryActiveStore();
			const archiveStore = new MemoryArchiveStore();
			const metadataStore = new MemoryMetadataStore();
			const lock = new DummyPlaylogLock();
			const playlogStore = new PlaylogStoreFacade({
				activeStore,
				archiveStore,
				metadataStore,
				lock,
			});

			await activeStore.putStartPoint(playId, startPoint1);
			const startPoint = (await playlogStore.getStartPoint(playId, 1)) as StartPoint;
			expect(startPoint).not.toBeNull();
			expect(startPoint.timestamp).toBe(12345678);
			expect(lock.called).toBe(0);
		});

		it("getStartPointでアーカイブにしか無い場合はactiveに戻してからstartPointが読み込まれる", async () => {
			const playId = "124378106";
			const activeStore = new MemoryActiveStore();
			const archiveStore = new MemoryArchiveStore();
			const metadataStore = new MemoryMetadataStore();
			const lock = new DummyPlaylogLock();
			const playlogStore = new PlaylogStoreFacade({
				activeStore,
				archiveStore,
				metadataStore,
				lock,
			});

			await metadataStore.setShouldGetFromArchive(playId, true);
			await archiveStore.store(playId, { original: [tick1, tick2], excludedIgnorable: [tick1, tick2] }, [startPoint1]);
			const startPoint = (await playlogStore.getStartPoint(playId, 1)) as StartPoint;
			expect(startPoint).not.toBeNull();
			expect(startPoint.timestamp).toBe(12345678);
			// ticks
			const activeStoreTicks = Array.from(activeStore.ticks.get(playId)?.values() ?? []);
			expect(activeStoreTicks).toEqual([tick1, tick2]);
			const activeStoreExcludedIgnorableTicks = Array.from(activeStore.excludedIgnorableTicks.get(playId)?.values() ?? []);
			expect(activeStoreExcludedIgnorableTicks).toEqual([tick1, tick2]);
			// start points
			const activeStoreStartPoints = Array.from(activeStore.startPoints.get(playId)?.values() ?? []);
			expect(activeStoreStartPoints).toEqual([startPoint1]);
			// locks
			expect(lock.called).toBe(1);
			expect(await metadataStore.shouldGetFromArchive(playId)).toBe(false);
		});

		it("getStartPointsでstartPointの配列を読み込める", async () => {
			const playId = "124378107";
			const activeStore = new MemoryActiveStore();
			const archiveStore = new MemoryArchiveStore();
			const metadataStore = new MemoryMetadataStore();
			const lock = new DummyPlaylogLock();
			const playlogStore = new PlaylogStoreFacade({
				activeStore,
				archiveStore,
				metadataStore,
				lock,
			});

			await activeStore.putStartPoint(playId, startPoint1);
			const startPoints = await playlogStore.getStartPoints({ playId, limit: 10 });
			expect(startPoints[0].timestamp).toBe(12345678);
			expect(lock.called).toBe(0);
		});

		it("getStartPointsでアーカイブにしか無い場合はactiveに戻してからstartPoint一覧が読み込まれる", async () => {
			const playId = "124378108";
			const activeStore = new MemoryActiveStore();
			const archiveStore = new MemoryArchiveStore();
			const metadataStore = new MemoryMetadataStore();
			const lock = new DummyPlaylogLock();
			const playlogStore = new PlaylogStoreFacade({
				activeStore,
				archiveStore,
				metadataStore,
				lock,
			});

			await metadataStore.setShouldGetFromArchive(playId, true);
			await archiveStore.store(playId, { original: [tick1, tick2], excludedIgnorable: [tick1, tick2] }, [startPoint1]);

			const startPoints = await playlogStore.getStartPoints({ playId, limit: 10 });
			expect(startPoints[0].timestamp).toBe(12345678);

			// ticks
			const activeStoreTicks = Array.from(activeStore.ticks.get(playId)?.values() ?? []);
			expect(activeStoreTicks).toEqual([tick1, tick2]);
			const activeStoreExcludedIgnorableTicks = Array.from(activeStore.excludedIgnorableTicks.get(playId)?.values() ?? []);
			expect(activeStoreExcludedIgnorableTicks).toEqual([tick1, tick2]);
			// start points
			const activeStoreStartPoints = Array.from(activeStore.startPoints.get(playId)?.values() ?? []);
			expect(activeStoreStartPoints).toEqual([startPoint1]);
			// locks
			expect(lock.called).toBe(1);
			expect(await metadataStore.shouldGetFromArchive(playId)).toBe(false);
		});

		it("getClosestStartPointで一番近いstartPointが読み込まれる", async () => {
			const playId = "124378109";
			const activeStore = new MemoryActiveStore();
			const archiveStore = new MemoryArchiveStore();
			const metadataStore = new MemoryMetadataStore();
			const lock = new DummyPlaylogLock();
			const playlogStore = new PlaylogStoreFacade({
				activeStore,
				archiveStore,
				metadataStore,
				lock,
			});

			await activeStore.putStartPoint(playId, startPoint1);
			const startPoint = (await playlogStore.getClosestStartPoint(playId, 2)) as StartPoint;
			expect(startPoint).not.toBeNull();
			expect(startPoint.timestamp).toBe(12345678);
			expect(lock.called).toBe(0);
		});

		it("getClosestStartPointでアーカイブにしか無い場合はactiveに戻してから一番近いstartPointが読み込まれる", async () => {
			const playId = "124378110";
			const activeStore = new MemoryActiveStore();
			const archiveStore = new MemoryArchiveStore();
			const metadataStore = new MemoryMetadataStore();
			const lock = new DummyPlaylogLock();
			const playlogStore = new PlaylogStoreFacade({
				activeStore,
				archiveStore,
				metadataStore,
				lock,
			});

			await metadataStore.setShouldGetFromArchive(playId, true);
			await archiveStore.store(playId, { original: [tick1, tick2], excludedIgnorable: [tick1, tick2] }, [startPoint1]);

			const startPoint = (await playlogStore.getClosestStartPoint(playId, 2)) as StartPoint;
			expect(startPoint).not.toBeNull();
			expect(startPoint.timestamp).toBe(12345678);

			// ticks
			const activeStoreTicks = Array.from(activeStore.ticks.get(playId)?.values() ?? []);
			expect(activeStoreTicks).toEqual([tick1, tick2]);
			const activeStoreExcludedIgnorableTicks = Array.from(activeStore.excludedIgnorableTicks.get(playId)?.values() ?? []);
			expect(activeStoreExcludedIgnorableTicks).toEqual([tick1, tick2]);
			// start points
			const activeStoreStartPoints = Array.from(activeStore.startPoints.get(playId)?.values() ?? []);
			expect(activeStoreStartPoints).toEqual([startPoint1]);
			// locks
			expect(lock.called).toBe(1);
			expect(await metadataStore.shouldGetFromArchive(playId)).toBe(false);
		});
	});
	describe("アーカイブ系操作", () => {
		it("updateLastAccessTimeを呼ぶとmetadataに最新時刻が書き込まれる", async () => {
			const playId = "124378111";
			const activeStore = new MemoryActiveStore();
			const archiveStore = new MemoryArchiveStore();
			const metadataStore = new MemoryMetadataStore();
			const lock = new DummyPlaylogLock();
			const playlogStore = new PlaylogStoreFacade({
				activeStore,
				archiveStore,
				metadataStore,
				lock,
			});

			metadataStore.metadata.set(playId, {
				playId,
				revision: 1,
				shouldGetFromArchive: false,
				hasArchived: true,
				lastAccessTime: new Date(12345678),
			});
			const now = Date.now();
			await playlogStore.updateLastAccessTime(playId);

			expect(metadataStore.metadata.get(playId)?.lastAccessTime?.getTime() ?? 0).toBeGreaterThanOrEqual(now);
		});

		it("アーカイブ作成", async () => {
			const playId = "124378112";
			const activeStore = new MemoryActiveStore();
			const archiveStore = new MemoryArchiveStore();
			const metadataStore = new MemoryMetadataStore();
			const lock = new DummyPlaylogLock();
			const playlogStore = new PlaylogStoreFacade({
				activeStore,
				archiveStore,
				metadataStore,
				lock,
			});

			metadataStore.metadata.set(playId, {
				playId,
				revision: 1,
				shouldGetFromArchive: false,
				hasArchived: false,
				lastAccessTime: new Date(12345678),
			});
			await activeStore.store(playId, { original: [tick1, tick2], excludedIgnorable: [tick1, tick2] }, [startPoint1]);

			await playlogStore.createArchive(playId);

			// ticks
			const archiveStoreTicks = Array.from(archiveStore.ticks.get(playId)?.original?.values() ?? []);
			expect(archiveStoreTicks).toEqual([tick1, tick2]);
			const archiveStoreExcludedIgnorableTicks = Array.from(archiveStore.ticks.get(playId)?.excludedIgnorable?.values() ?? []);
			expect(archiveStoreExcludedIgnorableTicks).toEqual([tick1, tick2]);
			// start points
			const archiveStoreStartPoints = Array.from(archiveStore.startPoints.get(playId)?.values() ?? []);
			expect(archiveStoreStartPoints).toEqual([startPoint1]);
			// locks
			expect(lock.called).toBe(1);
			// metadata
			expect(await metadataStore.getHasArchived(playId)).toBe(true);
		});

		it("データない状態でアーカイブ作成をしたらエラーになる", async () => {
			const playId = "124378113";
			const activeStore = new MemoryActiveStore();
			const archiveStore = new MemoryArchiveStore();
			const metadataStore = new MemoryMetadataStore();
			const lock = new DummyPlaylogLock();
			const playlogStore = new PlaylogStoreFacade({
				activeStore,
				archiveStore,
				metadataStore,
				lock,
			});

			await expect(playlogStore.createArchive(playId)).rejects.toThrow("アーカイブを作成しようとしましたがデータがありません");
		});

		it("データない状態でアーカイブ作成をしたらエラーになる", async () => {
			const activeStore = new MemoryActiveStore();
			const archiveStore = new MemoryArchiveStore();
			const metadataStore = new MemoryMetadataStore();
			const lock = new DummyPlaylogLock();
			const playlogStore = new PlaylogStoreFacade({
				activeStore,
				archiveStore,
				metadataStore,
				lock,
			});

			await expect(playlogStore.createArchive("2")).rejects.toThrow("アーカイブを作成しようとしましたがデータがありません");
		});

		it("hasArchiveフラグがtrueならばアーカイブ作成は成功するが何もしない", async () => {
			const playId = "124378114";
			const activeStore = new MemoryActiveStore();
			const archiveStore = new MemoryArchiveStore();
			const metadataStore = new MemoryMetadataStore();
			const lock = new DummyPlaylogLock();
			const playlogStore = new PlaylogStoreFacade({
				activeStore,
				archiveStore,
				metadataStore,
				lock,
			});

			metadataStore.metadata.set(playId, {
				playId,
				revision: 1,
				shouldGetFromArchive: false,
				hasArchived: true,
				lastAccessTime: new Date(12345678),
			});
			await activeStore.store(playId, { original: [tick1, tick2], excludedIgnorable: [tick1, tick2] }, [startPoint1]);

			await playlogStore.createArchive(playId);
			// archive
			expect(Array.from(archiveStore.ticks.values()).length).toBe(0);
			expect(Array.from(archiveStore.startPoints.values()).length).toBe(0);
			// lock
			expect(lock.called).toBe(1);
			// metadataStore
			expect(await metadataStore.getHasArchived(playId)).toBe(true);
		});

		it("pruneActiveをするとactiveの方からデータが削除される", async () => {
			const playId = "124378115";
			const activeStore = new MemoryActiveStore();
			const archiveStore = new MemoryArchiveStore();
			const metadataStore = new MemoryMetadataStore();
			const lock = new DummyPlaylogLock();
			const playlogStore = new PlaylogStoreFacade({
				activeStore,
				archiveStore,
				metadataStore,
				lock,
			});

			metadataStore.metadata.set(playId, {
				playId,
				revision: 1,
				shouldGetFromArchive: false,
				hasArchived: true,
				lastAccessTime: new Date(12345678),
			});
			await activeStore.store(playId, { original: [tick1, tick2], excludedIgnorable: [tick1, tick2] }, [startPoint1]);
			await archiveStore.store(playId, { original: [tick1, tick2], excludedIgnorable: [tick1, tick2] }, [startPoint1]);
			await playlogStore.pruneActive(playId);

			expect(Array.from(activeStore.ticks.values()).length).toBe(0);
			expect(Array.from(activeStore.startPoints.values()).length).toBe(0);
			expect(lock.called).toBe(1);
			expect(await metadataStore.shouldGetFromArchive(playId)).toBe(true);
		});

		it("shouldGetFromArchive===trueならば、pruneActiveしてもactiveからデータは削除されず何もしない", async () => {
			const playId = "124378116";
			const activeStore = new MemoryActiveStore();
			const archiveStore = new MemoryArchiveStore();
			const metadataStore = new MemoryMetadataStore();
			const lock = new DummyPlaylogLock();
			const playlogStore = new PlaylogStoreFacade({
				activeStore,
				archiveStore,
				metadataStore,
				lock,
			});

			metadataStore.metadata.set(playId, {
				playId,
				revision: 1,
				shouldGetFromArchive: true,
				hasArchived: true,
				lastAccessTime: new Date(12345678),
			});
			await activeStore.store(playId, { original: [tick1, tick2], excludedIgnorable: [tick1, tick2] }, [startPoint1]);
			await archiveStore.store(playId, { original: [tick1, tick2], excludedIgnorable: [tick1, tick2] }, [startPoint1]);
			await playlogStore.pruneActive(playId);

			expect(Array.from(activeStore.ticks.values()).length).not.toBe(0);
			expect(Array.from(activeStore.startPoints.values()).length).not.toBe(0);
			expect(lock.called).toBe(1);
			expect(await metadataStore.shouldGetFromArchive(playId)).toBe(true);
		});

		it("アーカイブ作成されてないときにpruneActiveを呼ぶと例外が飛ぶ", async () => {
			const playId = "124378117";
			const activeStore = new MemoryActiveStore();
			const archiveStore = new MemoryArchiveStore();
			const metadataStore = new MemoryMetadataStore();
			const lock = new DummyPlaylogLock();
			const playlogStore = new PlaylogStoreFacade({
				activeStore,
				archiveStore,
				metadataStore,
				lock,
			});

			metadataStore.metadata.set(playId, {
				playId,
				revision: 1,
				shouldGetFromArchive: false,
				hasArchived: false,
				lastAccessTime: new Date(12345678),
			});
			await expect(playlogStore.pruneActive(playId)).rejects.toThrow("アーカイブにデータがありません");
		});
	});
});
