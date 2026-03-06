import express = require("express");
import Controller = require("../controllers/Controller");

/**
 * ルーティング設定の配列をrouterに設定する
 * ルーティング設定は、{"マッピングするパス": コントローラオブジェクト}で行う
 * コントローラはget/post/put/delete関数とmiddlewaresプロパティを設定することができる(設定は必須ではない)
 * @type {express.Router}
 */
export function routeControllers(router: express.Router, routes: { [key: string]: Controller }) {
	Object.keys(routes).forEach((routePath) => {
		["get", "post", "put", "delete", "head", "patch", "options"].forEach((methodName) => {
			let requestHandler: express.RequestHandler = (routes[routePath] as any)[methodName];
			if (!requestHandler) {
				// 実装されてなければ登録しない
				return;
			}
			requestHandler = requestHandler.bind(routes[routePath]); // thisをbindしておく
			const routerMethod: (...handler: express.RequestHandler[]) => express.IRoute = (router as any)[methodName];
			const middlewares = routes[routePath].middlewares;
			let params: any[] = [routePath];
			if (middlewares) {
				params = params.concat(middlewares);
			}
			params.push(requestHandler);
			routerMethod.apply(router, params);
		});
	});
}
