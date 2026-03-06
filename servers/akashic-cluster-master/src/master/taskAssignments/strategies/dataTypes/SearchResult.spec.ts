import * as dt from "@akashic/server-engine-data-types";
import { BootQueueMessage } from "../../../queues/BootQueueMessage";
import { SearchResult } from "./SearchResult";
import { TaskAssignmentTarget } from "./TaskAssignmentTarget";

describe("dataTypes", () => {
	it("SearchResult", () => {
		const message: BootQueueMessage = {
			instanceId: "123",
			gameCode: "ncg333",
			entryPoint: "akashic/v1.0/entry.js",
			cost: 123,
			modules: [
				{
					code: "example",
					values: {
						foo: "bar",
					},
				},
			],
		};
		const target = new TaskAssignmentTarget(
			new dt.ClusterIdentity({
				type: dt.Constants.TYPE_GAME_RUNNER_2,
				name: "123",
				fqdn: new dt.Fqdn("cluster39.example.nico"),
				czxid: "909",
			}),
			8080,
			123,
		);
		const result = new SearchResult(target, 100, message);
		expect(result.score).toBe(100);
		expect(result.target).toBe(target);
		expect(result.message).toBe(message);
	});
});
