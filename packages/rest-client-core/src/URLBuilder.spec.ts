import URLBuilder = require("./URLBuilder");

describe("URLBuilder", () => {
	it("test-build1", () => {
		const builder = new URLBuilder("http://localhost:37444/foo/:fooId?bar=:barCond");
		const actual = builder.build({
			fooId: 123,
			barCond: "?1#://",
		});
		expect("http://localhost:37444/foo/123?bar=%3F1%23%3A%2F%2F").toEqual(actual);
	});
	it("test-build2", () => {
		const builder = new URLBuilder("http://localhost:37444/foo/:fooId");
		const actual = builder.build({
			fooId: 123,
			barCond: "?1#://",
		});
		expect("http://localhost:37444/foo/123").toEqual(actual);
	});
	it("test-build3", () => {
		const builder = new URLBuilder("http://localhost:37444/?bar=:barCond&baz=aaa");
		const actual = builder.build({
			fooId: 123,
			barCond: "?1#://",
		});
		expect("http://localhost:37444/?bar=%3F1%23%3A%2F%2F&baz=aaa").toEqual(actual);
	});
	it("test-build4", () => {
		const builder = new URLBuilder("http://localhost:37444/path/to/example");
		const actual = builder.build();
		expect("http://localhost:37444/path/to/example").toEqual(actual);
	});
	it("test-build5", () => {
		const builder = new URLBuilder("http://localhost:37444");
		const actual = builder.build();
		expect("http://localhost:37444/").toEqual(actual);
	});
	it("test-build-nodata", () => {
		const builder = new URLBuilder("http://localhost:37444/?bar=:barCond&baz=aaa");
		const actual = builder.build();
		expect("http://localhost:37444/?baz=aaa").toEqual(actual);
	});
	it("test-build-nodata2", () => {
		const builder = new URLBuilder("http://localhost:37444/foo/:fooId?bar=:barCond&baz=aaa");
		expect(() => builder.build()).toThrow();
	});
	it("test-build-nodata3", () => {
		const builder = new URLBuilder("http://localhost:37444/foo/:fooId?bar=:barCond&baz=aaa");
		expect(() => builder.build({ random: "value" })).toThrow();
	});
	it("test-error1", () => {
		expect(() => {
			// tslint:disable-next-line
			new URLBuilder("ぬるぽ");
		}).toThrow();
	});
	it("test-error2", () => {
		expect(() => {
			// tslint:disable-next-line
			new URLBuilder("http:///path");
		}).toThrow();
	});
	it("test-build-sequential", () => {
		const builder = new URLBuilder("http://localhost:37444/foo/?bar=:barCond&baz=:bazCond");
		const actualNodata = builder.build();
		expect(actualNodata).toEqual("http://localhost:37444/foo/");

		// use builder another conditions
		const actualBarCond = builder.build({
			barCond: "barCond",
		});
		expect(actualBarCond).toEqual("http://localhost:37444/foo/?bar=barCond");
		const actualBazCond = builder.build({
			bazCond: "bazCond",
		});
		expect(actualBazCond).toEqual("http://localhost:37444/foo/?baz=bazCond");
	});
});
