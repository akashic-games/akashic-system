import { Process, ProcessLike } from "../";

describe("Process", () => {
	const procLike: ProcessLike = {
		id: "1",
		playId: "1",
		trait: "websocket",
		numDispatchedClients: 1,
	};

	describe("constructor", () => {
		it("オブジェクトを生成できる", () => {
			const process = new Process(procLike);
			expect(process.id).toEqual(procLike.id);
			expect(process.playId).toEqual(procLike.playId);
			expect(process.trait).toEqual(procLike.trait);
			expect(process.numDispatchedClients).toEqual(procLike.numDispatchedClients);
		});
	});

	describe("fromObject", () => {
		it("オブジェクトを生成できる", () => {
			const process = Process.fromObject(procLike);
			expect(process.id).toEqual(procLike.id);
			expect(process.playId).toEqual(procLike.playId);
			expect(process.trait).toEqual(procLike.trait);
			expect(process.numDispatchedClients).toEqual(procLike.numDispatchedClients);
			const obj = {
				id: "1",
				playId: "1",
				trait: "websocket",
				numDispatchedClients: 1,
				data: 1,
				data2: 2,
			};

			expect(process.id).toEqual(obj.id);
			expect(process.playId).toEqual(obj.playId);
			expect(process.trait).toEqual(obj.trait);
			expect(process.numDispatchedClients).toEqual(obj.numDispatchedClients);
		});

		it("idが不正な場合はエラーを投げる", () => {
			// 存在しない
			expect(() =>
				Process.fromObject({
					playId: "1",
					trait: "websocket",
					numDispatchedClients: 1,
				}),
			).toThrowError();
			// 文字列ではない
			expect(() =>
				Process.fromObject({
					id: {},
					playId: "1",
					trait: "websocket",
					numDispatchedClients: 1,
				}),
			).toThrowError();
		});

		it("playIdが不正な場合はエラーを投げる", () => {
			// 存在しない
			expect(() =>
				Process.fromObject({
					id: "1",
					trait: "websocket",
					numDispatchedClients: 1,
				}),
			).toThrowError();
			// 文字列ではない
			expect(() =>
				Process.fromObject({
					id: "1",
					playId: {},
					trait: "websocket",
					numDispatchedClients: 1,
				}),
			).toThrowError();
		});

		it("traitが不正な場合はエラーを投げる", () => {
			// 存在しない
			expect(() =>
				Process.fromObject({
					id: "1",
					playId: "1",
					numDispatchedClients: 1,
				}),
			).toThrowError();
			// 文字列ではない
			expect(() =>
				Process.fromObject({
					id: "1",
					playId: "1",
					trait: {},
					numDispatchedClients: 1,
				}),
			).toThrowError();
		});

		it("numDispatchedClientsが不正な場合はエラーを投げる", () => {
			// 存在しない
			expect(() =>
				Process.fromObject({
					id: "1",
					playId: "1",
					trait: "websocket",
				}),
			).toThrowError();
			// 数値ではない
			expect(() =>
				Process.fromObject({
					id: "1",
					playId: "1",
					trait: "websocket",
					numDispatchedClients: "max",
				}),
			).toThrowError();
		});

		it("引数がnullの場合はエラーを投げる", () => {
			expect(() => Process.fromObject(null)).toThrowError();
		});
	});

	describe("toJSON", () => {
		it("JSONオブジェクトに変換できる", () => {
			const process = new Process(procLike);
			expect(process.id).toEqual(procLike.id);
			expect(process.playId).toEqual(procLike.playId);
			expect(process.trait).toEqual(procLike.trait);
			expect(process.numDispatchedClients).toEqual(procLike.numDispatchedClients);
			const json = process.toJSON();
			expect(json.id).toEqual(procLike.id);
			expect(json.playId).toEqual(procLike.playId);
			expect(json.trait).toEqual(procLike.trait);
			expect(json.numDispatchedClients).toEqual(procLike.numDispatchedClients);
		});
	});
});
