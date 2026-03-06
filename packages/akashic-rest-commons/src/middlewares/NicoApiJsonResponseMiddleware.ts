import express = require("express");

/**
 * Response.jsonをニコニコシステム間APIの使用にするためのMiddleware
 * @type req {express.Request}
 * @type res {express.Response}
 * @type next {Function}
 */
function nicoApiJsonResponseMiddleware(_: express.Request | undefined, res: express.Response, next: Function): any {
	const originalJson = res.json.bind(res);
	res.json = (s: any, b?: any): express.Response => {
		const body = typeof b === "undefined" ? s : b;
		const statusCode = typeof b === "undefined" ? res.statusCode : s;
		res.type("application/json");
		return originalJson({
			meta: {
				status: statusCode,
			},
			data: body,
		});
	};
	(res as any).originalJson = originalJson;
	return next();
}

export = nicoApiJsonResponseMiddleware;
