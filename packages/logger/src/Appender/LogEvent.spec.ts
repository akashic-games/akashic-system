import { contextToJSON, contextToJSONString } from "./LogEvent";

describe("contextToJSON", () => {
	it("should returns Map entries Array", () => {
		const context = new Map();
		context.set("foo", "foo foo");
		context.set("bar", "bar bar");

		const result = contextToJSON(context);
		expect(result).toEqual([
			["foo", "foo foo"],
			["bar", "bar bar"],
		]);
	});

	it("should returns empty Array as entries if context does NOT be passed", () => {
		const result = contextToJSON();
		expect(result).toEqual([]);
	});
});

describe("contextToJSONString", () => {
	it("should returns Map entries Array String", () => {
		const context = new Map();
		context.set("foo", "foo foo");
		context.set("bar", "bar bar");

		const result = contextToJSONString(context);
		expect(result).toBe('[["foo","foo foo"],["bar","bar bar"]]');
	});

	it("should returns empty Array as entries if context does NOT be passed", () => {
		const result = contextToJSONString();
		expect(result).toBe("[]");
	});
});
