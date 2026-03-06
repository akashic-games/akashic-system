import * as Cast from "./";

describe("index", () => {
	it("test-int", () => {
		expect(Cast.int(123)).toEqual(123);
		expect(Cast.int("123")).toEqual(123);
		expect(Cast.int("9007199254740992")).toEqual(9007199254740992);
		expect(Cast.int(-9007199254740992)).toEqual(-9007199254740992);
		expect(() => Cast.int("123.4")).toThrow();
		expect(() => Cast.int(["123"], false, "foobar")).toThrow();
		expect(() => Cast.int("9007199254740993")).toThrow();
		expect(() => Cast.int("-9007199254740993", false, "foobar")).toThrow();
		expect(() => Cast.int(undefined)).toThrow();
		expect(Cast.int(undefined, true)).toBeUndefined();
		expect(Cast.int(null, true)).toBeNull();
	});
	it("test-bigint", () => {
		expect(Cast.bigint(123)).toEqual("123");
		expect(Cast.bigint("123")).toEqual("123");
		expect(Cast.bigint("9223372036854775807")).toEqual("9223372036854775807");
		expect(() => Cast.bigint("123.4")).toThrow();
		expect(() => Cast.bigint(["123"], false, "foobar")).toThrow();
		expect(() => Cast.bigint(undefined)).toThrow();
		expect(Cast.bigint(undefined, true)).toBeUndefined();
		expect(Cast.bigint(null, true)).toBeNull();
	});
	it("test-number", () => {
		expect(Cast.number(123)).toEqual(123);
		expect(Cast.number("123")).toEqual(123);
		expect(Cast.number("123.4")).toEqual(123.4);
		expect(() => Cast.number(["123"])).toThrow();
		expect(() => Cast.number("invalid number", false, "foobar")).toThrow();
		expect(() => Cast.number(undefined)).toThrow();
		expect(Cast.number(undefined, true)).toBeUndefined();
		expect(Cast.number(null, true)).toBeNull();
	});
	it("test-rangeInt", () => {
		expect(Cast.rangeInt(123, 0, 123)).toEqual(123);
		expect(Cast.rangeInt(0, 0, 123)).toEqual(0);
		expect(Cast.rangeInt("123", 0, 123)).toEqual(123);
		expect(() => Cast.rangeInt(-1, 0, 256)).toThrow();
		expect(() => Cast.rangeInt("257", 0, 256, false, "foobar")).toThrow();
		expect(() => Cast.rangeInt("123.4", 0, 256)).toThrow();
		expect(() => Cast.rangeInt(["123"], 0, 256, false, "foobar")).toThrow();
		expect(() => Cast.rangeInt(undefined, 0, 256)).toThrow();
		expect(Cast.rangeInt(undefined, 0, 256, true)).toBeUndefined();
		expect(Cast.rangeInt(null, 0, 256, true)).toBeNull();
	});
	it("test-string", () => {
		expect(Cast.string("hoge")).toEqual("hoge");
		expect(Cast.string("123")).toEqual("123");
		expect(Cast.string("123", 3)).toEqual("123");
		expect(() => Cast.string(123)).toThrow();
		expect(() => Cast.string(["123"], 3, false, "foobar")).toThrow();
		expect(() => Cast.string("1233", 3)).toThrow();
		expect(() => Cast.string(undefined)).toThrow();
		expect(Cast.string(undefined, undefined, true)).toBeUndefined();
		expect(Cast.string(null, undefined, true)).toBeNull();
	});
	it("test-rangeString", () => {
		expect(Cast.rangeString("hoge", ["hoge", "fuga", "piyo"])).toEqual("hoge");
		expect(Cast.rangeString("piyo", ["hoge", "fuga", "piyo"])).toEqual("piyo");
		expect(() => Cast.rangeString("foo", ["hoge", "fuga", "piyo"])).toThrow();
		expect(() => Cast.rangeString("bar", ["hoge", "fuga", "piyo"], false, "foobar")).toThrow();
		expect(() => Cast.rangeString(undefined, ["hoge", "fuga", "piyo"])).toThrow();
		expect(Cast.rangeString(undefined, ["hoge", "fuga", "piyo"], true)).toBeUndefined();
		expect(Cast.rangeString(null, ["hoge", "fuga", "piyo"], true)).toBeNull();
	});
	it("test-fqdnOrHostname", () => {
		expect(Cast.fqdnOrHostname("hoge")).toEqual("hoge");
		expect(Cast.fqdnOrHostname("foo.bar")).toEqual("foo.bar");
		expect(Cast.fqdnOrHostname("foobar.example.com")).toEqual("foobar.example.com");
		expect(() => Cast.fqdnOrHostname("ninja#slayer")).toThrow();
		expect(() => Cast.fqdnOrHostname("日本語", false, "foobar")).toThrow();
		expect(() => Cast.fqdnOrHostname(":token")).toThrow();
		expect(() => Cast.fqdnOrHostname("")).toThrow();
		expect(Cast.fqdnOrHostname(undefined, true)).toBeUndefined();
		expect(Cast.fqdnOrHostname(null, true)).toBeNull();
	});
	it("test-uriUnreserved", () => {
		expect(Cast.uriUnreserved("hoge")).toEqual("hoge");
		expect(Cast.uriUnreserved("123")).toEqual("123");
		expect(Cast.uriUnreserved("123", 3)).toEqual("123");
		expect(Cast.uriUnreserved("abc-123.456_789~")).toEqual("abc-123.456_789~");
		expect(() => Cast.uriUnreserved("http://www.nicovideo.jp/")).toThrow();
		expect(() => Cast.uriUnreserved("お名前.com", 10, false, "foobar")).toThrow();
		expect(() => Cast.uriUnreserved("1233", 3)).toThrow();
		expect(() => Cast.uriUnreserved(undefined)).toThrow();
		expect(Cast.uriUnreserved(undefined, undefined, true)).toBeUndefined();
		expect(Cast.uriUnreserved(null, undefined, true)).toBeNull();
	});
	it("test-ascii", () => {
		expect(Cast.ascii("hoge")).toEqual("hoge");
		expect(Cast.ascii("123")).toEqual("123");
		expect(Cast.ascii("123", 3)).toEqual("123");
		expect(Cast.ascii("http://www.nicovideo.jp/abc-123.456_789~")).toEqual("http://www.nicovideo.jp/abc-123.456_789~");
		expect(() => Cast.ascii("http://www。nicovideo.jp/")).toThrow();
		expect(() => Cast.ascii("お名前.com", 10, false, "foobar")).toThrow();
		expect(() => Cast.ascii("1233", 3)).toThrow();
		expect(() => Cast.ascii(undefined)).toThrow();
		expect(Cast.ascii(undefined, undefined, true)).toBeUndefined();
		expect(Cast.ascii(null, undefined, true)).toBeNull();
	});
	it("test-date", () => {
		const dateObj = new Date();
		const dateStr = "2001-01-07T00:00:00+0900";
		expect(Cast.date(dateObj)).toEqual(dateObj);
		expect(Cast.date(dateStr).getTime()).toEqual(new Date(dateStr).getTime());
		expect(() => Cast.date([dateObj])).toThrow();
		expect(() => Cast.date("invalid date string", false, "foobar")).toThrow();
		expect(() => Cast.date(undefined)).toThrow();
		expect(Cast.date(undefined, true)).toBeUndefined();
		expect(Cast.date(null, true)).toBeNull();
	});
});
