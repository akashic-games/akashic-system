import { InstanceModule } from "./InstanceModule";

describe("InstanceModule", () => {
	it("fromObject", () => {
		let m: InstanceModule;
		let values: any;
		m = InstanceModule.fromObject({ code: "example" });
		expect(m.code).toBe("example");
		expect(m.values).toBeUndefined();
		values = {};
		m = InstanceModule.fromObject({ code: "hoge", values });
		expect(m.code).toBe("hoge");
		expect(m.values).toBe(values);
		const jsonObj = m.toJSON();
		expect(jsonObj.code).toBe("hoge");
		expect(jsonObj.values).toBe(values);
		expect(() => InstanceModule.fromObject({ code: new Date() })).toThrow();
		expect(() => InstanceModule.fromObject(undefined)).toThrow();
	});
	it("fromObjects", () => {
		const values = { foo: "bar", baz: 1 };
		const result = InstanceModule.fromObjects([{ code: "aaa" }, { code: "bbb", values }]);
		expect(result.length).toBe(2);
		expect(result[0].code).toBe("aaa");
		expect(result[0].values).toBeUndefined();
		expect(result[1].code).toBe("bbb");
		expect(result[1].values).toBe(values);
		expect(() => InstanceModule.fromObjects(null)).toThrow();
	});
});
