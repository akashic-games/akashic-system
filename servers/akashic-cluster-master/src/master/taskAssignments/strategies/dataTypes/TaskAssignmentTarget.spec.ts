import * as dt from "@akashic/server-engine-data-types";
import { TaskAssignmentTarget } from "./TaskAssignmentTarget";

describe("dataTypes", () => {
	it("TaskAssignmentTarget", () => {
		const identity = new dt.ClusterIdentity({
			type: dt.Constants.TYPE_GAME_RUNNER_2,
			name: "311592",
			fqdn: new dt.Fqdn("cluster115.example.nico"),
			czxid: "555",
		});
		const target = new TaskAssignmentTarget(identity, 8080, 123);
		expect(target.cost).toBe(123);
		expect(target.targetPort).toBe(8080);
		expect(target.targetIdentity).toBe(identity);
	});
});
