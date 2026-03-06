import { BootQueueMessage } from "../../../queues/BootQueueMessage";
import { EvaluateResult } from "./EvaluateResult";
import { Requirement } from "./Requirement";

describe("dataTypes", () => {
	it("EvaluateResult", () => {
		const message: BootQueueMessage = {
			instanceId: "123",
			gameCode: "ncg333",
			entryPoint: "akashic/v1.0/entry.js",
			cost: 10,
			modules: [
				{
					code: "example",
					values: {
						foo: "bar",
					},
				},
			],
		};
		const requirement = new Requirement("gameRunner", 10, false);
		const result = new EvaluateResult(message, requirement);
		expect(result.message).toBe(message);
		expect(result.requirement).toBe(requirement);
		const jsonValue = result.toJSON();
		expect(jsonValue.message).toBe(message);
		expect(jsonValue.requirements).toBe(requirement);
	});
});
