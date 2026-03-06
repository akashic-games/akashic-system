import Fqdn = require("../valueobjects/Fqdn");
import Process = require("./Process");
import ProcessLike = require("./ProcessLike");

describe("Process", () => {
	it("test-constructor", () => {
		const data: ProcessLike = {
			clusterIdentity: {
				fqdn: new Fqdn("foobar.example.com"),
				type: "gameRunner",
				name: "10",
				czxid: "37564",
			},
			port: 12345,
			machineValues: {
				capacity: 223,
			},
		};
		const process = new Process(data);
		expect(data.port).toEqual(process.port);
		expect(data.clusterIdentity.fqdn.value).toEqual(process.clusterIdentity.fqdn.value);
		expect(data.clusterIdentity.name).toEqual(process.clusterIdentity.name);
		expect(data.clusterIdentity.type).toEqual(process.clusterIdentity.type);
		expect(data.clusterIdentity.czxid).toEqual(process.clusterIdentity.czxid);
		expect(JSON.stringify(data.machineValues)).toEqual(JSON.stringify(process.machineValues));
	});
});
