import express = require("express");
import middleware = require("../NicoApiJsonResponseMiddleware");

describe("NicoApiJsonResponseMiddleware", () => {
	it("handler", () => {
		const statusCode = 123;
		const body = "foobar";
		const res: any = {
			statusCode,
			json: (obj: any) => {
				expect(obj.meta.status).toBe(statusCode);
				expect(obj.data).toBe(body);
			},
			type: (resType: string) => expect(resType).toBe("application/json"),
		};
		let flag = false;
		middleware(undefined, res as express.Response, () => (flag = true));
		expect(flag).toBeTruthy();
		res.json(body);
	});
});
