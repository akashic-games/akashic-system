import FQDN = require("../../src/valueobjects/Fqdn");

describe("FQDN", () => {
	it("test-all", () => {
		const host = "foobar.example.com";
		const fqdn = new FQDN(host);
		expect(host).toEqual(fqdn.value);
		expect(host).toEqual(fqdn.toJSON());
		expect("com.example.foobar").toEqual(fqdn.toReverseFQDN());
		expect(["com", "example", "foobar"]).toEqual(fqdn.reverse());
	});
	it("test-rfqdn", () => {
		const rhost = "com.example.foobar";
		const fqdn = FQDN.fromReverseFqdn(rhost);
		expect("foobar.example.com").toEqual(fqdn.value);
	});
	it("test-fromObject", () => {
		const data1 = "foobar.example.com";
		const data2 = new FQDN("foo.example.com");
		const data2_2 = { value: "foo.example.com" };
		const data3: any = null;
		const data4 = () => {};
		const fqdn1 = FQDN.fromObject(data1);
		expect(fqdn1.value).toEqual(data1);
		const fqdn2 = FQDN.fromObject(data2);
		expect(fqdn2.value).toEqual(data2.value);
		const fqdn2_2 = FQDN.fromObject(data2_2);
		expect(fqdn2_2.value).toEqual(data2_2.value);
		expect(() => FQDN.fromObject(data3)).toThrow();
		expect(() => FQDN.fromObject(data4)).toThrow();
	});
});
