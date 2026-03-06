import FQDN = require("../../src/valueobjects/Fqdn");
import ProcessIdentity = require("../../src/valueobjects/ProcessIdentity");
import ProcessIdentityLike = require("../../src/valueobjects/ProcessIdentityLike");

describe("ProcessIdentity", () => {
	it("test-constructor", () => {
		const data: ProcessIdentityLike = {
			type: "foo",
			name: "100",
			fqdn: new FQDN("foobar.example.com"),
		};
		const identity = new ProcessIdentity(data);
		expect(data.type).toEqual(identity.type);
		expect(data.name).toEqual(identity.name);
		expect(data.fqdn.value).toEqual(identity.fqdn.value);
		expect("com.example.foobar." + data.type + "." + data.name).toEqual(identity.getKeyString());
		expect(data).toEqual(identity.toJSON());
	});
	it("test-fromObject", () => {
		let identity: ProcessIdentity;
		const data: ProcessIdentityLike = {
			type: "foo",
			name: "100",
			fqdn: new FQDN("foobar.example.com"),
		};
		identity = ProcessIdentity.fromObject(data);
		expect(data.type).toEqual(identity.type);
		expect(data.name).toEqual(identity.name);
		expect(data.fqdn.value).toEqual(identity.fqdn.value);
		const data2 = {
			type: "foo",
			name: "100",
			fqdn: "foobar.example.com",
		};
		identity = ProcessIdentity.fromObject(data2);
		expect(data2.type).toEqual(identity.type);
		expect(data2.name).toEqual(identity.name);
		expect(data2.fqdn).toEqual(identity.fqdn.value);
		identity = ProcessIdentity.fromObject(identity);
		expect(data2.type).toEqual(identity.type);
		expect(data2.name).toEqual(identity.name);
		expect(data2.fqdn).toEqual(identity.fqdn.value);
	});
	it("test-fromObject-error", () => {
		const data = {
			type() {},
			name: "100",
			fqdn: new FQDN("foobar.example.com"),
		};
		expect(() => ProcessIdentity.fromObject(data)).toThrow();
		const data2 = {
			type: "foo",
			name: {},
			fqdn: "foobar.example.com",
		};
		expect(() => ProcessIdentity.fromObject(data2)).toThrow();
		expect(() => ProcessIdentity.fromObject(null)).toThrow();
	});
});
