import { AmqpNotFoundError } from "./";

describe("AmqpNotFoundError", () => {
	it("can construct", () => {
		const cause = new Error("error");
		const error = new AmqpNotFoundError("not found", cause);
		expect(error.message).toBe("not found");
		expect(error.cause).toEqual(cause);
	});
});
