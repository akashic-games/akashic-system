import * as dt from "@akashic/server-engine-data-types";
import { AliveNode } from "./AliveNode";

describe("AliveNode", () => {
	it("test-constructor", () => {
		const processIdentity = {
			fqdn: new dt.Fqdn("foobar.example.com"),
			type: dt.Constants.TYPE_GAME_RUNNER_2,
			name: "444",
		};
		const aliveNode = new AliveNode(processIdentity, "/path/to/example", "567");
		expect(processIdentity.fqdn.value).toEqual(aliveNode.identity.fqdn.value);
		expect(processIdentity.type).toEqual(aliveNode.identity.type);
		expect(processIdentity.name).toEqual(aliveNode.identity.name);
		expect("567").toEqual(aliveNode.identity.czxid);
		expect("/path/to/example").toEqual(aliveNode.zPath);
	});
});
