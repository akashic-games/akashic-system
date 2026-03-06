import * as playlog from "@akashic/playlog";
import * as playlogPack from "./encoder";

describe("encoder", () => {
	describe("playlog", () => {
		const ticks: playlog.Tick[] = [
			[1],
			[2],
			[3],
			[4],
			[5],
			[6],
			[7],
			[8],
			[9, [[playlog.EventCode.Join, 3, "123", "tom"]]],
			[10],
			[
				11,
				[],
				[
					{
						readKey: { region: 1, regionKey: "foo.bar", gameId: "$gameId" },
						values: [{ data: "apple", tag: "fruit", storageKey: { region: 1, regionKey: "foo.bar", gameId: "123" } }],
					},
				],
			],
		];
		const events: playlog.Event[] = [
			[0x21, 2, "tom", 300, 2, 10, 200],
			[0x21, 4, "jack", 200, 4, 20, 234],
		];

		const allEvents: playlog.Event[] = [
			// join
			[0x0, 2, "id1", "tom"],
			// join with storage data
			[
				0x0,
				2,
				"id1",
				"tom",
				[
					{
						readKey: { region: 1, regionKey: "foo.bar", gameId: "$gameId", userId: "id1", options: { keyOrder: 1, valueOrder: 2 } },
						values: [
							{ data: "string", tag: "string", storageKey: { region: 1, regionKey: "foo.bar", gameId: "123", userId: "id1" } },
							{ data: 123, tag: "number", storageKey: { region: 1, regionKey: "foo.bar", gameId: "123", userId: "id1" } },
						],
					},
				],
			],
			// leave
			[0x1, 2, "id1"],
			// timestamp
			[0x2, 2, "id2", 1234567890],
			// player info
			[0x3, 2, "id3", "name", { foo: "bar", baz: 123 }],
			// message event
			[0x20, 2, "id4", "message"],
			// point down
			[0x21, 2, "id5", 300, 2, 10, 200],
			// point move
			[0x22, 0, "id6", 200, 4, 20, 0.5, 0.5, 5, 7, 123, 1],
			// point up
			[0x23, 0, "id7", 200, 4, 10, 1, 1, 15, 17, 777, 2],
			// operation
			[0x40, 1, "id8", 16, [1, 2.2, "hoge"]],
		];
		const allEncodedEvents: string[] = [
			"940002a3696431a3746f6d",
			"950002a3696431a3746f6d9182a7726561644b657985a6726567696f6e01a9726567696f6e4b6579a7666f6f2e626172a667616d654964a72467616d654964a6757365724964a3696431a76f7074696f6e7382a86b65794f7264657201aa76616c75654f7264657202a676616c7565739283a464617461a6737472696e67a3746167a6737472696e67aa73746f726167654b657984a6726567696f6e01a9726567696f6e4b6579a7666f6f2e626172a667616d654964a3313233a6757365724964a369643183a4646174617ba3746167a66e756d626572aa73746f726167654b657984a6726567696f6e01a9726567696f6e4b6579a7666f6f2e626172a667616d654964a3313233a6757365724964a3696431",
			"930102a3696431",
			"940202a3696432ce499602d2",
			"950302a3696433a46e616d6582a3666f6fa3626172a362617a7b",
			"942002a3696434a76d657373616765",
			"972102a3696435cd012c020accc8",
			"9c2200a3696436ccc80414cb3fe0000000000000cb3fe000000000000005077b01",
			"9c2300a3696437ccc8040a01010f11cd030902",
			"954001a3696438109301cb400199999999999aa4686f6765",
		];

		it("#encodeTick/#decodeTick", () => {
			for (let i = 0; i < ticks.length; ++i) {
				expect(playlogPack.decodeTick(playlogPack.encodeTick(ticks[i]))).toEqual(ticks[i]);
			}
		});
		it("#encodeEvent/#decodeEvent", () => {
			for (let i = 0; i < events.length; ++i) {
				expect(playlogPack.decodeEvent(playlogPack.encodeEvent(events[i]))).toEqual(events[i]);
			}
		});
		it("#encodeEvent check bin formats", () => {
			for (let i = 0; i < allEvents.length; ++i) {
				const bin = playlogPack.encodeEvent(allEvents[i]);
				const hex = bin.toString("hex");
				expect(hex).toBe(allEncodedEvents[i]);
			}
		});

		it("#decodeEvent check bin formats", () => {
			for (let i = 0; i < allEvents.length; ++i) {
				const bin = Buffer.from(allEncodedEvents[i] ?? "", "hex");
				expect(playlogPack.decodeEvent(bin)).toEqual(allEvents[i]);
			}
		});
	});
});
