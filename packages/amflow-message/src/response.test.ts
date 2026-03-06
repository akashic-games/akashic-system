import * as amflow from "@akashic/amflow";
import * as playlog from "@akashic/playlog";
import * as msgpack from "msgpack-lite";

import { Opcode } from "./Opcode";
import * as Response from "./Response";
import * as tickListConverter from "./TickListConverter";

describe("Response", () => {
	const error: Response.ResponseError = { name: "PermissionError" };
	describe("OpenResponse", () => {
		it("#toPacket", () => {
			const res = new Response.OpenResponse();
			expect(res.toPacket()).toEqual([Opcode.Open, null]);
		});
		it("#toPacket - has error", () => {
			const res = new Response.OpenResponse(error);
			expect(res.toPacket()).toEqual([Opcode.Open, error]);
		});
		it("#fromPacket", () => {
			const res = new Response.OpenResponse();
			expect(Response.OpenResponse.fromPacket(res.toPacket())).toEqual(res);
		});
		it("#fromPacket - has error", () => {
			const res = new Response.OpenResponse(error);
			expect(Response.OpenResponse.fromPacket(res.toPacket())).toEqual(res);
		});
	});
	describe("AuthenticateResponse", () => {
		const permission: amflow.Permission = {
			writeTick: true,
			readTick: true,
			subscribeTick: false,
			sendEvent: true,
			subscribeEvent: true,
			maxEventPriority: 3,
		};
		it("#toPacket", () => {
			const res = new Response.AuthenticateResponse(null, permission);
			expect(res.toPacket()).toEqual([Opcode.Authenticate, null, permission]);
		});
		it("#toPacket - has error", () => {
			const res = new Response.AuthenticateResponse(error);
			expect(res.toPacket()).toEqual([Opcode.Authenticate, error, null]);
		});
		it("#fromPacket", () => {
			const res = new Response.AuthenticateResponse(null, permission);
			expect(Response.AuthenticateResponse.fromPacket(res.toPacket())).toEqual(res);
		});
		it("#fromPacket - has error", () => {
			const res = new Response.AuthenticateResponse(error);
			expect(Response.AuthenticateResponse.fromPacket(res.toPacket())).toEqual(res);
		});
	});
	describe("CloseResponse", () => {
		it("#toPacket", () => {
			const res = new Response.CloseResponse();
			expect(res.toPacket()).toEqual([Opcode.Close, null]);
		});
		it("#toPacket - has error", () => {
			const res = new Response.CloseResponse(error);
			expect(res.toPacket()).toEqual([Opcode.Close, error]);
		});
		it("#fromPacket", () => {
			const res = new Response.CloseResponse();
			expect(Response.CloseResponse.fromPacket(res.toPacket())).toEqual(res);
		});
		it("#fromPacket - has error", () => {
			const res = new Response.CloseResponse(error);
			expect(Response.CloseResponse.fromPacket(res.toPacket())).toEqual(res);
		});
	});
	describe("GetTickListResponse", () => {
		const ticks: playlog.Tick[] = [[10], [11], [12], [13], [14], [15], [16, [[playlog.EventCode.Join, 3, "123", "tom"]]], [17], [18], [19]];

		it("#toPacket", () => {
			const res = new Response.GetTickListResponse(null, tickListConverter.fromTicks(ticks));
			expect(res.toPacket()).toEqual([Opcode.GetTickList, null, 10, 19, [ticks[6]]]);
		});
		it("#toPacket - empty", () => {
			const res = new Response.GetTickListResponse(null, tickListConverter.fromTicks([]));
			expect(res.toPacket()).toEqual([Opcode.GetTickList, null]);
		});
		it("#toPacket - has error", () => {
			const res = new Response.GetTickListResponse(error);
			expect(res.toPacket()).toEqual([Opcode.GetTickList, error]);
		});
		it("#fromPacket", () => {
			const res = new Response.GetTickListResponse(null, tickListConverter.fromTicks(ticks));
			expect(Response.GetTickListResponse.fromPacket(res.toPacket())).toEqual(res);
		});
		it("#fromPacket - empty", () => {
			const res = new Response.GetTickListResponse(null, tickListConverter.fromTicks([]));
			expect(Response.GetTickListResponse.fromPacket(res.toPacket())).toEqual(res);
		});
		it("#fromPacket - has error", () => {
			const res = new Response.GetTickListResponse(error);
			expect(Response.GetTickListResponse.fromPacket(res.toPacket())).toEqual(res);
		});
	});
	describe("PutStartPointResponse", () => {
		it("#toPacket", () => {
			const res = new Response.PutStartPointResponse(null);
			expect(res.toPacket()).toEqual([Opcode.PutStartPoint, null]);
		});
		it("#toPacket - has error", () => {
			const res = new Response.PutStartPointResponse(error);
			expect(res.toPacket()).toEqual([Opcode.PutStartPoint, error]);
		});
		it("#fromPacket", () => {
			const res = new Response.PutStartPointResponse(null);
			expect(Response.PutStartPointResponse.fromPacket(res.toPacket())).toEqual(res);
		});
		it("#fromPacket - has error", () => {
			const res = new Response.PutStartPointResponse(error);
			expect(Response.PutStartPointResponse.fromPacket(res.toPacket())).toEqual(res);
		});
	});
	describe("GetStartPointResponse", () => {
		const startPoint: amflow.StartPoint = { frame: 20, timestamp: 100, data: "foo" };
		it("#toPacket", () => {
			const res = new Response.GetStartPointResponse(null, startPoint);
			expect(res.toPacket()).toEqual([Opcode.GetStartPoint, null, startPoint]);
		});
		it("#toPacket - has error", () => {
			const res = new Response.GetStartPointResponse(error);
			expect(res.toPacket()).toEqual([Opcode.GetStartPoint, error, null]);
		});
		it("#fromPacket", () => {
			const res = new Response.GetStartPointResponse(null, startPoint);
			expect(Response.GetStartPointResponse.fromPacket(res.toPacket())).toEqual(res);
		});
		it("#fromPacket - has error", () => {
			const res = new Response.GetStartPointResponse(error);
			expect(Response.GetStartPointResponse.fromPacket(res.toPacket())).toEqual(res);
		});
	});
	describe("PutStorageDataResponse", () => {
		it("#toPacket", () => {
			const res = new Response.PutStorageDataResponse();
			expect(res.toPacket()).toEqual([Opcode.PutStorageData, null]);
		});
		it("#toPacket - has error", () => {
			const res = new Response.PutStorageDataResponse(error);
			expect(res.toPacket()).toEqual([Opcode.PutStorageData, error]);
		});
		it("#fromPacket", () => {
			const res = new Response.PutStorageDataResponse();
			expect(Response.PutStorageDataResponse.fromPacket(res.toPacket())).toEqual(res);
		});
		it("#fromPacket - has error", () => {
			const res = new Response.PutStorageDataResponse(error);
			expect(Response.PutStorageDataResponse.fromPacket(res.toPacket())).toEqual(res);
		});
	});
	describe("GetStorageDataResponse", () => {
		const storageData: playlog.StorageData[] = [
			{
				readKey: { region: 1, regionKey: "a001.b001", gameId: "ggg", userId: "uuu" },
				values: [{ data: "apple" }, { data: "orange" }],
			},
		];
		it("#toPacket", () => {
			const res = new Response.GetStorageDataResponse(null, storageData);
			expect(res.toPacket()).toEqual([Opcode.GetStorageData, null, storageData]);
		});
		it("#toPacket - has error", () => {
			const res = new Response.GetStorageDataResponse(error);
			expect(res.toPacket()).toEqual([Opcode.GetStorageData, error, null]);
		});
		it("#fromPacket", () => {
			const res = new Response.GetStorageDataResponse(null, storageData);
			expect(Response.GetStorageDataResponse.fromPacket(res.toPacket())).toEqual(res);
		});
		it("#fromPacket - has error", () => {
			const res = new Response.GetStorageDataResponse(error);
			expect(Response.GetStorageDataResponse.fromPacket(res.toPacket())).toEqual(res);
		});
	});
	describe("encode/decode", () => {
		it("GetTickList", () => {
			const ticks: playlog.Tick[] = [
				[10],
				[11],
				[12],
				[13],
				[14],
				[15],
				[16, [[playlog.EventCode.Join, 3, "123", "tom"]]],
				[17],
				[18],
				[19],
			];
			const res = new Response.GetTickListResponse(null, tickListConverter.fromTicks(ticks));
			expect(Response.decode(Response.encode(res))).toEqual(res);
		});
		it("GetTickList - has error", () => {
			const res = new Response.GetTickListResponse(error);
			expect(Response.decode(Response.encode(res))).toEqual(res);
		});
	});
	describe("GetTickListResponse - assemble", () => {
		it("createEncodedDirect - not hasEventTicks", () => {
			const ticks: playlog.Tick[] = [[10], [11], [12], [13]];
			const ticksUnnormalized: (playlog.Tick | number)[] = [
				// 数値自体(ageのみ)のティックを扱うパスを確認する用データ
				10,
				[11],
				[12],
				13,
			];
			const res = new Response.GetTickListResponse(null, tickListConverter.fromTicks(ticks));
			const rawTicks = ticksUnnormalized.map((t) => msgpack.encode(t));
			const encodedRes = Response.GetTickListResponse.createEncodedDirect(rawTicks);
			expect(Response.decode(encodedRes)).toEqual(res);
			// エンコード結果に「数値のみのティック」がイベントつきティックとして含まれていないことを確認
			expect(Array.prototype.slice.call(encodedRes)).toEqual([
				0x94, // Array(4)
				0x04, // OpCode.GetTickList === fixint 4
				0xc0, // null
				0x0a, // fixint 10
				0x0d, // fixint 13
			]);
		});
		it("createEncodedDirect - hasEventTicks", () => {
			const ticks: playlog.Tick[] = [
				[10],
				[11],
				[12],
				[
					13,
					[
						[playlog.EventCode.Join, 3, "123", "tom"],
						[playlog.EventCode.Message, 2, "123", { foo: 42 }],
					],
				],
				[14],
				[15],
				[16, [[playlog.EventCode.Leave, 3, "123"]]],
				[17],
				[18],
				[19],
			];
			const res = new Response.GetTickListResponse(null, tickListConverter.fromTicks(ticks));
			const rawTicks = ticks.map((t) => msgpack.encode(t));
			const encodedRes = Response.GetTickListResponse.createEncodedDirect(rawTicks);
			expect(Response.decode(encodedRes)).toEqual(res);
		});
		it("createEncodedDirect - zero ticks", () => {
			const res = new Response.GetTickListResponse(null, tickListConverter.fromTicks([]));
			const encodedRes = Response.GetTickListResponse.createEncodedDirect([]);
			expect(Response.decode(encodedRes)).toEqual(res);
		});
		it("createEncodedDirect - one tick", () => {
			const ticks: playlog.Tick[] = [[10]];
			const res = new Response.GetTickListResponse(null, tickListConverter.fromTicks(ticks));
			const rawTicks = ticks.map((t) => msgpack.encode(t));
			const encodedRes = Response.GetTickListResponse.createEncodedDirect(rawTicks);
			expect(Response.decode(encodedRes)).toEqual(res);
		});
		it("createEncodedDirect - 16+ event ticks", () => {
			const ticks: playlog.Tick[] = [];
			const len = 500;
			for (let i = 0; i < len; ++i) {
				ticks.push([i, [[playlog.EventCode.Message, 2, "123", { foo: i * i }]]]);
			}
			const res = new Response.GetTickListResponse(null, tickListConverter.fromTicks(ticks));
			const rawTicks = ticks.map((t) => msgpack.encode(t));
			const encodedRes = Response.GetTickListResponse.createEncodedDirect(rawTicks);
			expect(Response.decode(encodedRes)).toEqual(res);
		});
		it("createEncodedDirect - 65536+ event ticks", () => {
			const ticks: playlog.Tick[] = [];
			const len = 65539;
			for (let i = 0; i < len; ++i) {
				ticks.push([i, [[playlog.EventCode.Message, 2, "123", { foo: 2 * i }]]]);
			}
			const res = new Response.GetTickListResponse(null, tickListConverter.fromTicks(ticks));
			const rawTicks = ticks.map((t) => msgpack.encode(t));
			const encodedRes = Response.GetTickListResponse.createEncodedDirect(rawTicks);
			expect(Response.decode(encodedRes)).toEqual(res);
		});
	});
});
