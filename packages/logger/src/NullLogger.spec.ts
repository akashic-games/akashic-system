import { NullLogger } from "./NullLogger";

describe("NullLogger", () => {
	describe("writeLog method", () => {
		it("should do nothing", async () => {
			const logger = new NullLogger();
			await logger.writeLog();
		});
	});
});
