import DateJsonReplacer = require("../DateJsonReplacer");

class DummyApp {
	private jsonReplacer: Function | undefined;
	public get() {
		return this.jsonReplacer;
	}
	public set(_: string, value: Function) {
		this.jsonReplacer = value;
	}
}

// システムのタイムゾーンに依存したテストが書かれているため。
xdescribe("DateJsonReplacerSpec", () => {
	it("testValidDate", () => {
		const expected = "2014-05-01T20:45:20+0900";
		const target = new Date(Date.parse(expected));
		const app: any = new DummyApp();
		DateJsonReplacer.setUp(app);
		const result = JSON.parse(JSON.stringify({ actual: target }, app.get()));
		expect(result.actual).toEqual(expected);
	});
	it("testValidDate2", () => {
		const expected = "2014-05-01T20:45:20+0900";
		const target = new Date(Date.parse(expected));
		const app: any = new DummyApp();
		let flag = false;
		app.set("", (_: any, value: any) => {
			flag = true;
			return value;
		});
		DateJsonReplacer.setUp(app);
		const result = JSON.parse(JSON.stringify({ actual: target }, app.get()));
		expect(result.actual).toEqual(expected);
		expect(flag).toBeTruthy();
	});
});
