import PagingResponse = require("./PagingResponse");
import PagingResponseLike = require("./PagingResponseLike");

describe("PagingResponse", () => {
	it("test-constructor", () => {
		const data: PagingResponseLike<number> = {
			values: [1, 2, 3],
		};
		let res = new PagingResponse<number>(data);
		expect(res.values).toEqual(data.values);
		expect(res.totalCount).toBeUndefined();
		data.totalCount = "3";
		res = new PagingResponse<number>(data);
		expect(res.values).toEqual(data.values);
		expect(res.totalCount).toEqual(data.totalCount);
	});
	it("test-fromObject", () => {
		const data: PagingResponseLike<number> = {
			values: [1, 2, 3],
		};
		let res = PagingResponse.fromObject<number>(new PagingResponse<number>(data).toJSON(), { fromObject: (obj: any) => obj as number });
		expect(res.values).toEqual(data.values);
		expect(res.totalCount).toBeUndefined();
		data.totalCount = "3";
		res = PagingResponse.fromObject<number>(new PagingResponse<number>(data).toJSON(), { fromObject: (obj: any) => obj as number });
		expect(res.values).toEqual(data.values);
		expect(res.totalCount).toEqual(data.totalCount);
	});
	it("test-fromObject-error", () => {
		let data: any = {
			values: { foo: 1 },
		};
		expect(() => PagingResponse.fromObject<number>(data, { fromObject: (obj: any) => obj as number })).toThrow();
		data = {
			values: [1, 2, 3],
			totalCount: "$",
		};
		expect(() => PagingResponse.fromObject<number>(data, { fromObject: (obj: any) => obj as number })).toThrow();
		expect(() => PagingResponse.fromObject<number>(null, { fromObject: (obj: any) => obj as number })).toThrow();
	});
});
