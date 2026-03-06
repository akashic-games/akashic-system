import * as dt from "@akashic/server-engine-data-types";
import { InstanceAssignmentStatus } from "./InstanceAssignmentStatus";

describe("dataTypes", () => {
	it("InstanceAssignmentStatus", () => {
		const identity = new dt.ClusterIdentity({
			type: dt.Constants.TYPE_GAME_RUNNER_2,
			name: "123",
			fqdn: new dt.Fqdn("cluster39.example.nico"),
			czxid: "909",
		});
		const item = new InstanceAssignmentStatus(identity, 100);
		expect(item.identity).toBe(identity);
		expect(item.assigned).toBe(100);
	});
});
