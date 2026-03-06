import * as playlog from "@akashic/playlog";
import * as tickListConverter from "./TickListConverter";

describe("TickListConverter", () => {
	const ticks: playlog.Tick[] = [[1], [2], [3], [4], [5], [6], [7], [8], [9, [[playlog.EventCode.Join, 3, "123", "tom"]]], [10], [11]];
	it("#fromTicks", () => {
		expect(tickListConverter.fromTicks(ticks)).toEqual([1, 11, [ticks[8]]]);
	});
	it("#fromTicks - empty", () => {
		expect(tickListConverter.fromTicks([])).toBe(null);
	});
	it("#toTicks", () => {
		const list = tickListConverter.fromTicks(ticks);
		expect(tickListConverter.toTicks(list)).toEqual(ticks);
	});
	it("#toTicks - empty", () => {
		expect(tickListConverter.toTicks(null)).toEqual([]);
	});
});
