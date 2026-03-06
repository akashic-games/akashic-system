import ClusterIdentity = require("../../src/valueobjects/ClusterIdentity");
import ClusterIdentityLike = require("../../src/valueobjects/ClusterIdentityLike");
import FQDN = require("../../src/valueobjects/Fqdn");
import ProcessIdentityLike = require("../../src/valueobjects/ProcessIdentityLike");

describe("ClusterIdentity", () => {
	it("test-constructor", () => {
		const data: ClusterIdentityLike = {
			type: "foo",
			name: "100",
			fqdn: new FQDN("foobar.example.com"),
			czxid: "12345",
		};
		const identity = new ClusterIdentity(data);
		expect(data.type).toEqual(identity.type);
		expect(data.name).toEqual(identity.name);
		expect(data.fqdn.value).toEqual(identity.fqdn.value);
		expect(data.czxid).toEqual(identity.czxid);
		expect("com.example.foobar." + data.type + "." + data.name + "." + data.czxid).toEqual(identity.getKeyString());
		expect(true).toEqual(identity.isSame(data));
	});
	it("test-fromProcessAndCzxid", () => {
		const data: ProcessIdentityLike = {
			type: "foo",
			name: "100",
			fqdn: new FQDN("hoge.example.com"),
		};
		const czxid = "11111";
		const identity = ClusterIdentity.fromProcessAndCzxid(data, czxid);
		expect(data.type).toEqual(identity.type);
		expect(data.name).toEqual(identity.name);
		expect(czxid).toEqual(identity.czxid);
		expect(data.fqdn.value).toEqual(identity.fqdn.value);
	});
});
