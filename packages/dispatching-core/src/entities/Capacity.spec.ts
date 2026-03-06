import { Capacity, CapacityLike } from "../";

describe("Capacity", () => {
	const capacityLike: CapacityLike = {
		processId: "1",
		trait: "websocket",
		capacity: 1,
	};

	describe("constructor", () => {
		it("オブジェクトを生成できる", () => {
			const capacity = new Capacity(capacityLike);
			expect(capacity.processId).toEqual(capacityLike.processId);
			expect(capacity.trait).toEqual(capacityLike.trait);
			expect(capacity.capacity).toEqual(capacityLike.capacity);
		});
	});

	describe("fromObject", () => {
		it("オブジェクトを生成できる", () => {
			const capacity = Capacity.fromObject(capacityLike);
			expect(capacity.processId).toEqual(capacityLike.processId);
			expect(capacity.trait).toEqual(capacityLike.trait);
			expect(capacity.capacity).toEqual(capacityLike.capacity);
			const obj = {
				processId: "1",
				trait: "websocket",
				capacity: 1,
				data: 1,
				data2: 2,
			};
			const capacity2 = Capacity.fromObject(obj);
			expect(capacity2.processId).toEqual(obj.processId);
			expect(capacity2.trait).toEqual(obj.trait);
			expect(capacity2.capacity).toEqual(obj.capacity);
		});

		it("processIdが不正な場合はエラーを投げる", () => {
			// 存在しない
			expect(() =>
				Capacity.fromObject({
					trait: "websocket",
					capacity: 1,
				}),
			).toThrowError();
			// 文字列ではない
			expect(() =>
				Capacity.fromObject({
					processId: {},
					trait: "websocket",
					capacity: 1,
				}),
			).toThrowError();
		});

		it("traitが不正な場合はエラーを投げる", () => {
			// 存在しない
			expect(() =>
				Capacity.fromObject({
					processId: "1",
					capacity: 1,
				}),
			).toThrowError();
			// 文字列ではない
			expect(() =>
				Capacity.fromObject({
					processId: "1",
					trait: {},
					capacity: 1,
				}),
			).toThrowError();
		});

		it("capacityが不正な場合はエラーを投げる", () => {
			// 存在しない
			expect(() =>
				Capacity.fromObject({
					processId: "1",
					trait: "websocket",
				}),
			).toThrowError();
			// 数値ではない
			expect(() =>
				Capacity.fromObject({
					processId: "1",
					trait: "websocket",
					capacity: "many",
				}),
			).toThrowError();
		});

		it("引数がnullの場合はエラーを投げる", () => {
			expect(() => Capacity.fromObject(null)).toThrowError();
		});
	});

	describe("toJSON", () => {
		it("JSONオブジェクトに変換できる", () => {
			const capacity = Capacity.fromObject(capacityLike);
			expect(capacity.processId).toEqual(capacityLike.processId);
			expect(capacity.trait).toEqual(capacityLike.trait);
			expect(capacity.capacity).toEqual(capacityLike.capacity);
			const json = capacity.toJSON();
			expect(json.processId).toEqual(capacityLike.processId);
			expect(json.trait).toEqual(capacityLike.trait);
			expect(json.capacity).toEqual(capacityLike.capacity);
		});
	});
});
