import { Requirement } from "./Requirement";

describe("dataTypes", () => {
	it("Requirement", () => {
		const processType = "gameRunner";
		const cost = 10;
		const req = new Requirement(processType, cost, true);
		expect(req.processType).toBe(processType);
		expect(req.cost).toBe(req.cost);
		const jsonValue = req.toJSON();
		expect(jsonValue.processType).toBe(processType);
		expect(jsonValue.cost).toBe(cost);
		expect(jsonValue.video).toBeTruthy();
	});
});
