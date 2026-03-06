import Endpoint = require("../../src/valueobjects/Endpoint");
import Fqdn = require("../../src/valueobjects/Fqdn");

describe("Endpoint", () => {
	it("test-constructor", () => {
		const data = {
			fqdn: new Fqdn("foobar.example.com"),
			port: 37564,
		};
		const endpoint = new Endpoint(data);
		expect(data.fqdn.value).toEqual(endpoint.fqdn.value);
		expect(data.port).toEqual(endpoint.port);
		const jsonObj = endpoint.toJSON();

		expect(data.fqdn).toEqual(jsonObj.fqdn);
		expect(data.port).toEqual(jsonObj.port);
		const endpoint2 = Endpoint.fromBuffer(endpoint.toBuffer());
		expect(data.fqdn.value).toEqual(endpoint2.fqdn.value);
		expect(data.port).toEqual(endpoint2.port);
	});
	it("test-fromBufferError", () => {
		const data1 = {
			foo: "bar",
		};
		const data2 = {
			fqdn: {},
			port: 37564,
		};
		expect(() => Endpoint.fromBuffer(Buffer.from(JSON.stringify(data1), "utf-8"))).toThrow();
		expect(() => Endpoint.fromBuffer(Buffer.from(JSON.stringify(data2), "utf-8"))).toThrow();
	});
});
