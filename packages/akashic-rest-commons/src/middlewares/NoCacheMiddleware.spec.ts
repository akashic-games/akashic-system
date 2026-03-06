import express = require("express");
import middleware = require("./NoCacheMiddleware");

describe("NoCacheMiddleware", () => {
	it("handler", () => {
		const cacheInfo = {
			"Cache-Control": "no-cache, no-store, must-revalidate",
			Pragma: "no-cache",
			Expires: "0",
		};
		const res: any = {
			set: (resType: any) => expect(resType).toEqual(cacheInfo),
		};
		let flag = false;
		middleware(undefined, res as express.Response, () => (flag = true));
		expect(flag).toBeTruthy();
	});
});
