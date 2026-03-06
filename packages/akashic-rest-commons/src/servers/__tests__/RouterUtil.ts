import Util = require("../RouterUtil");

class GetOnlyController {
	public flag = false;
	public get() {
		this.flag = true;
	}
}
class FullController {
	public flags: { [key: string]: boolean } = {};
	public middlewares = ["a", "b"];
	public get() {
		this.flags.get = true;
	}
	public post() {
		this.flags.post = true;
	}
	public put() {
		this.flags.put = true;
	}
	public delete() {
		this.flags.delete = true;
	}
}

describe("RouterUtil", () => {
	it("routeControllersGet", () => {
		const path = "/v1.0/test/something";
		const controller = new GetOnlyController();
		const router: any = {
			get(...args: any[]) {
				expect(args.length).toBe(2);
				expect(args[0]).toEqual(path);
				args[1]();
			},
		};
		const routes: { [key: string]: any } = {};
		routes[path] = controller;
		Util.routeControllers(router, routes);
	});
	it("routeControllersAll", () => {
		const path = "/v1.0/test/rest";
		const controller = new FullController();
		const router: any = {
			get(...args: any[]) {
				expect(args.length).toBe(4);
				expect(args[0]).toEqual(path);
				expect(args[1]).toEqual(controller.middlewares[0]);
				expect(args[2]).toEqual(controller.middlewares[1]);
				args[3]();
			},
			post(...args: any[]) {
				expect(args.length).toBe(4);
				expect(args[0]).toEqual(path);
				expect(args[1]).toEqual(controller.middlewares[0]);
				expect(args[2]).toEqual(controller.middlewares[1]);
				args[3]();
			},
			put(...args: any[]) {
				expect(args.length).toBe(4);
				expect(args[0]).toEqual(path);
				expect(args[1]).toEqual(controller.middlewares[0]);
				expect(args[2]).toEqual(controller.middlewares[1]);
				args[3]();
			},
			delete(...args: any[]) {
				expect(args.length).toBe(4);
				expect(args[0]).toEqual(path);
				expect(args[1]).toEqual(controller.middlewares[0]);
				expect(args[2]).toEqual(controller.middlewares[1]);
				args[3]();
			},
		};
		const routes: { [key: string]: any } = {};
		routes[path] = controller;
		Util.routeControllers(router, routes);
	});
});
