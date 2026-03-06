import express = require("express");

/**
 * キャッシュ無効設定するミドルウェア
 * @type req {express.Request}
 * @type res {express.Response}
 * @type next {Function}
 */
function noCacheMiddleware(_: express.Request | undefined, res: express.Response, next: Function): any {
	res.set({
		"Cache-Control": "no-cache, no-store, must-revalidate",
		Pragma: "no-cache",
		Expires: "0",
	});
	return next();
}

export = noCacheMiddleware;
