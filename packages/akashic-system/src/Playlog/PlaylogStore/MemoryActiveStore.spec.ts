import { StartPoint } from "@akashic/amflow";
import { Tick } from "@akashic/playlog";
import { MemoryActiveStore } from "./MemoryActiveStore";

describe("MemoryActiveStore", () => {
	const playId = "1";
	const testTicks: Tick[] = [[1], [2], [3], [4], [5], [6], [7], [8], [9], [10], [11]];
	const testStartPoints: StartPoint[] = [
		{
			frame: 1,
			timestamp: 12345,
			data: "",
		},
		{
			frame: 3,
			timestamp: 67890,
			data: "",
		},
	];

	it("tickが空状態の時のgetTick/getTicksRaw/getAllTicksのテスト", async () => {
		const store = new MemoryActiveStore();

		await expect(store.getTick(playId, 1)).resolves.toBe(null);
		let buffers = await store.getTicksRaw({ playId, limit: 10 });
		expect(buffers.length).toBe(0);
		buffers = await store.getTicksRaw({ playId, limit: 10, frameFrom: 1, frameTo: 3 });
		expect(buffers.length).toBe(0);
		const ticks = await store.getAllTicks(playId);
		expect(ticks.original.length).toBe(0);
	});

	it("putTick/updateTickでデータを入れた時のgetTick/getTicksRaw/getAllTicksのテスト", async () => {
		const store = new MemoryActiveStore();
		// 保存と更新
		await store.putTick(playId, testTicks[0]);
		await store.putTick(playId, testTicks[1]);
		await store.putTick(playId, testTicks[2]);
		await store.updateTick(playId, [1, []]);

		const tick = await store.getTick(playId, 1);
		expect(tick && tick[0]).toBe(1);
		expect(tick && tick[1]?.length).toBe(0);
		let buffers = await store.getTicksRaw({ playId, limit: 10 });
		expect(buffers.length).toBe(3);
		buffers = await store.getTicksRaw({ playId, limit: 10, frameFrom: 1, frameTo: 3 });
		expect(buffers.length).toBe(2);
		const ticks = await store.getAllTicks(playId);
		expect(ticks.original.length).toBe(3);
	});

	it("データ数がlimit指定よりも多い時のgetTicksRawのテスト", async () => {
		const store = new MemoryActiveStore();
		for (const testTick of testTicks) {
			await store.putTick(playId, testTick);
		}

		let buffers = await store.getTicksRaw({ playId, limit: 10 });
		expect(buffers.length).toBe(10);
		buffers = await store.getTicksRaw({ playId, limit: 10, frameFrom: 1, frameTo: 3 });
		expect(buffers.length).toBe(2);
		buffers = await store.getTicksRaw({ playId, limit: 10, frameFrom: 1, frameTo: 11 });
		expect(buffers.length).toBe(10);
		const ticks = await store.getAllTicks(playId);
		expect(ticks.original.length).toBe(11);
	});

	it("startPointが空のときのgetStartPoints/getClosestStartPoint/getAllStartPointsのテスト", async () => {
		const store = new MemoryActiveStore();

		await expect(store.getStartPoint(playId, 1)).resolves.toBe(null);
		let startPoints = await store.getStartPoints({ playId, limit: 10 });
		expect(startPoints.length).toBe(0);
		const startPoint = await store.getClosestStartPoint(playId, 2);
		expect(startPoint).toBe(null);
		startPoints = await store.getAllStartPoints(playId);
		expect(startPoints.length).toBe(0);
	});

	it("putStartPointでデータを入れた時のgetStartPoints/getClosestStartPoint/getAllStartPointsのテスト", async () => {
		const store = new MemoryActiveStore();

		// 保存
		await store.putStartPoint(playId, testStartPoints[0]);
		await store.putStartPoint(playId, testStartPoints[1]);
		// データアリでの取得テスト
		let startPoint = await store.getStartPoint(playId, 1);
		expect(startPoint && startPoint.frame).toBe(1);
		let startPoints = await store.getStartPoints({ playId, limit: 10 });
		expect(startPoints.length).toBe(2);
		startPoint = await store.getClosestStartPoint(playId, 2);
		expect(startPoint && startPoint.frame).toBe(1);
		startPoint = await store.getClosestStartPoint(playId, 4);
		expect(startPoint && startPoint.frame).toBe(3);
		startPoints = await store.getAllStartPoints(playId);
		expect(startPoints.length).toBe(2);
	});

	it("データ数がlimit指定よりも多い時のgetStartPointsのテスト", async () => {
		const store = new MemoryActiveStore();

		for (let i = 0; i < 11; ++i) {
			const startPoint = { ...testStartPoints[0] };
			startPoint.frame = i + 1;
			await store.putStartPoint(playId, startPoint);
		}
		let startPoints = await store.getStartPoints({ playId, limit: 10 });
		expect(startPoints.length).toBe(10);
		startPoints = await store.getAllStartPoints(playId);
		expect(startPoints.length).toBe(11);
	});
});
