import { Opcode } from "./Opcode";
import * as Request from "./Request";
import type { ExcludeEventFlags } from "@akashic/akashic-system";

describe("Request", () => {
	describe("OpenRequest", () => {
		it("#toPacket", () => {
			const req = new Request.OpenRequest("100");
			expect(req.toPacket()).toEqual([Opcode.Open, "100"]);
		});
		it("#fromPacket", () => {
			const req = new Request.OpenRequest("100");
			expect(Request.OpenRequest.fromPacket(req.toPacket())).toEqual(req);
		});
	});
	describe("AuthenticateRequest", () => {
		it("#toPacket", () => {
			const req = new Request.AuthenticateRequest("abcd");
			expect(req.toPacket()).toEqual([Opcode.Authenticate, "abcd"]);
		});
		it("#fromPacket", () => {
			const req = new Request.AuthenticateRequest("abcd");
			expect(Request.AuthenticateRequest.fromPacket(req.toPacket())).toEqual(req);
		});
	});
	describe("CloseRequest", () => {
		it("#toPacket", () => {
			const req = new Request.CloseRequest();
			expect(req.toPacket()).toEqual([Opcode.Close]);
		});
		it("#fromPacket", () => {
			const req = new Request.CloseRequest();
			expect(Request.CloseRequest.fromPacket(req.toPacket())).toEqual(req);
		});
	});
	describe("GetTickListRequest", () => {
		it("#toPacket", () => {
			const excludeEventFlags: ExcludeEventFlags = { ignorable: false };
			const req = new Request.GetTickListRequest(1, 100, excludeEventFlags);
			expect(req.toPacket()).toEqual([Opcode.GetTickList, 1, 100, excludeEventFlags]);
		});
		it("#toPacketIgnorable", () => {
			const excludeEventFlags: ExcludeEventFlags = { ignorable: true };
			const req = new Request.GetTickListRequest(1, 100, excludeEventFlags);
			expect(req.toPacket()).toEqual([Opcode.GetTickList, 1, 100, excludeEventFlags]);
		});
		it("#fromPacket", () => {
			const excludeEventFlags: ExcludeEventFlags = { ignorable: true };
			const req = new Request.GetTickListRequest(1, 100, excludeEventFlags);
			expect(Request.GetTickListRequest.fromPacket(req.toPacket())).toEqual(req);
		});
	});
	describe("PutStartPointRequest", () => {
		it("#toPacket", () => {
			const req = new Request.PutStartPointRequest({ frame: 20, timestamp: 100, data: "foo" });
			expect(req.toPacket()).toEqual([Opcode.PutStartPoint, { frame: 20, timestamp: 100, data: "foo" }]);
		});
		it("#fromPacket", () => {
			const req = new Request.PutStartPointRequest({ frame: 20, timestamp: 100, data: "foo" });
			expect(Request.PutStartPointRequest.fromPacket(req.toPacket())).toEqual(req);
		});
	});
	describe("GetStartPointRequest", () => {
		it("#toPacket", () => {
			const req = new Request.GetStartPointRequest({});
			expect(req.toPacket()).toEqual([Opcode.GetStartPoint, {}]);
		});
		it("#fromPacket", () => {
			const req = new Request.GetStartPointRequest({});
			expect(Request.GetStartPointRequest.fromPacket(req.toPacket())).toEqual(req);
		});
		it("#toPacket by frame", () => {
			const req = new Request.GetStartPointRequest({ frame: 1234567890 });
			expect(req.toPacket()).toEqual([Opcode.GetStartPoint, { frame: 1234567890 }]);
		});
		it("#fromPacket in frame", () => {
			const req = new Request.GetStartPointRequest({ frame: 1234567890 });
			expect(Request.GetStartPointRequest.fromPacket(req.toPacket())).toEqual(req);
		});
	});
	describe("GetStartPointByTimestampRequest", () => {
		it("#toPacket by timestamp", () => {
			const req = new Request.GetStartPointByTimestampRequest({ timestamp: 1234567890 });
			expect(req.toPacket()).toEqual([Opcode.GetStartPoint, { timestamp: 1234567890 }]);
		});
		it("#fromPacket in timestamp", () => {
			const req = new Request.GetStartPointByTimestampRequest({ timestamp: 1234567890 });
			expect(Request.GetStartPointByTimestampRequest.fromPacket(req.toPacket())).toEqual(req);
		});
	});
	describe("PutStorageDataRequest", () => {
		const storageKey = { region: 1, regionKey: "a001.b001", gameId: "ggg", userId: "uuu" };
		const storageValue = { data: "apple" };
		it("#toPacket", () => {
			const req = new Request.PutStorageDataRequest(storageKey, storageValue, {});
			expect(req.toPacket()).toEqual([Opcode.PutStorageData, storageKey, storageValue, {}]);
		});
		it("#fromPacket", () => {
			const req = new Request.PutStorageDataRequest(storageKey, storageValue, {});
			expect(Request.PutStorageDataRequest.fromPacket(req.toPacket())).toEqual(req);
		});
	});
	describe("GetStorageDataRequest", () => {
		const storageKey = { region: 1, regionKey: "a001.b001", gameId: "ggg", userId: "uuu" };
		it("#toPacket", () => {
			const req = new Request.GetStorageDataRequest([storageKey]);
			expect(req.toPacket()).toEqual([Opcode.GetStorageData, [storageKey]]);
		});
		it("#fromPacket", () => {
			const req = new Request.GetStorageDataRequest([storageKey]);
			expect(Request.GetStorageDataRequest.fromPacket(req.toPacket())).toEqual(req);
		});
	});
	describe("encode/decode", () => {
		it("all", () => {
			const excludeEventFlags: ExcludeEventFlags = { ignorable: true };
			const req = new Request.GetTickListRequest(1, 100, excludeEventFlags);
			expect(Request.decode(Request.encode(req))).toEqual(req);
		});
	});
});
