import Instance = require("./Instance");
import InstanceLike = require("./InstanceLike");
import { InstanceModuleLike } from "./InstanceModuleLike";

function testModule(e: InstanceModuleLike[], a: InstanceModuleLike[]) {
	expect(e.length).toBe(a.length);
	for (let index = 0; index < e.length; index++) {
		const element1 = e[index];
		const element2 = a[index];
		expect(element1.code).toBe(element2.code);
		expect(element1.values).toBe(element2.values);
	}
}

describe("Instance", () => {
	const gameCode = "ncg456";
	const cost = 1000;
	const processName = "spec-process";
	const entryPoint = "/data/spec/entry.js";

	it("test-constructor", () => {
		const data: InstanceLike = {
			gameCode,
			status: "prepare",
			region: "nodeServerEngine",
			modules: [
				{
					code: "someModule",
					values: { foo: "bar" },
				},
			],
			exitCode: 1,
			cost,
			processName,
			entryPoint,
		};
		const instance = new Instance(data);
		expect(instance.gameCode).toEqual(data.gameCode);
		expect(instance.id).toBeUndefined();
		expect(instance.status).toEqual(data.status);
		testModule(instance.modules, data.modules);
		expect(instance.region).toEqual(data.region);
		expect(instance.exitCode).toEqual(data.exitCode);
		expect(instance.cost).toEqual(data.cost);
		expect(instance.processName).toEqual(data.processName);
		expect(instance.entryPoint).toEqual(data.entryPoint);
	});
	it("test-constructor-nullable", () => {
		const data: InstanceLike = {
			gameCode,
			status: "prepare",
			region: "nodeServerEngine",
			modules: [
				{
					code: "someModule",
					values: { foo: "bar" },
				},
			],
			cost,
			entryPoint,
		};
		const instance = new Instance(data);
		expect(instance.gameCode).toEqual(data.gameCode);
		expect(instance.id).toBeUndefined();
		expect(instance.status).toEqual(data.status);
		testModule(instance.modules, data.modules);
		expect(instance.region).toEqual(data.region);
		expect(instance.exitCode).toBeUndefined();
		expect(instance.cost).toEqual(data.cost);
		expect(instance.processName).toBeUndefined();
		expect(instance.entryPoint).toEqual(data.entryPoint);
	});

	it("test-constructor-with-args(id)", () => {
		const data: InstanceLike = {
			gameCode,
			status: "prepare",
			region: "nodeServerEngine",
			modules: [
				{
					code: "someModule",
					values: { foo: "bar" },
				},
			],
			cost,
			entryPoint,
		};
		const instance = new Instance(data, "44445555");
		expect(instance.gameCode).toEqual(data.gameCode);
		expect(instance.id).toEqual("44445555");
		expect(instance.status).toEqual(data.status);
		testModule(instance.modules, data.modules);
		expect(instance.region).toEqual(data.region);
		expect(instance.exitCode).toBeUndefined();
		expect(instance.cost).toEqual(data.cost);
		expect(instance.processName).toBeUndefined();
		expect(instance.entryPoint).toEqual(data.entryPoint);
	});
	it("test-constructor-with-args(id,exitCode)", () => {
		const data: InstanceLike = {
			gameCode,
			status: "prepare",
			region: "nodeServerEngine",
			modules: [
				{
					code: "someModule",
					values: { foo: "bar" },
				},
			],
			cost,
			entryPoint,
		};
		const instance = new Instance(data, "44445555", 123);
		expect(instance.gameCode).toEqual(data.gameCode);
		expect(instance.id).toEqual("44445555");
		expect(instance.status).toEqual(data.status);
		testModule(instance.modules, data.modules);
		expect(instance.region).toEqual(data.region);
		expect(instance.exitCode).toEqual(123);
		expect(instance.cost).toEqual(data.cost);
		expect(instance.processName).toBeUndefined();
		expect(instance.entryPoint).toEqual(data.entryPoint);
	});
	it("test-constructor-with-args(id,exitCode,processName)", () => {
		const data: InstanceLike = {
			gameCode,
			status: "prepare",
			region: "nodeServerEngine",
			modules: [
				{
					code: "someModule",
					values: { foo: "bar" },
				},
			],
			cost,
			entryPoint,
		};
		const instance = new Instance(data, "44445555", 123, "args-processName");
		expect(instance.gameCode).toEqual(data.gameCode);
		expect(instance.id).toEqual("44445555");
		expect(instance.status).toEqual(data.status);
		testModule(instance.modules, data.modules);
		expect(instance.region).toEqual(data.region);
		expect(instance.exitCode).toEqual(123);
		expect(instance.cost).toEqual(data.cost);
		expect(instance.processName).toEqual("args-processName");
		expect(instance.entryPoint).toEqual(data.entryPoint);
	});

	it("test-constructor-override", () => {
		const data: InstanceLike = {
			id: "111222",
			gameCode,
			status: "prepare",
			region: "nodeServerEngine",
			exitCode: 123,
			modules: [
				{
					code: "someModule",
					values: { foo: "bar" },
				},
			],
			cost,
			processName,
			entryPoint,
		};
		const instance = new Instance(data, "44445555", 456, "args-processName");
		expect(instance.gameCode).toEqual(data.gameCode);
		expect(instance.id).toEqual("44445555");
		expect(instance.status).toEqual(data.status);
		testModule(instance.modules, data.modules);
		expect(instance.region).toEqual(data.region);
		expect(instance.exitCode).toEqual(456);
		expect(instance.cost).toEqual(data.cost);
		expect(instance.processName).toEqual("args-processName");
		expect(instance.entryPoint).toEqual(data.entryPoint);
	});
	it("test-toJSON", () => {
		let data: InstanceLike = {
			gameCode,
			status: "prepare",
			region: "nodeServerEngine",
			modules: [
				{
					code: "someModule",
					values: { foo: "bar" },
				},
			],
			cost,
			entryPoint,
		};
		let instance = new Instance(data).toJSON();
		expect(instance.gameCode).toEqual(data.gameCode);
		expect(instance.id).toBeUndefined();
		expect(instance.status).toEqual(data.status);
		testModule(instance.modules, data.modules);
		expect(instance.region).toEqual(data.region);
		expect(instance.exitCode).toBeUndefined();
		expect(instance.cost).toEqual(data.cost);
		expect(instance.processName).toBeUndefined();
		expect(instance.entryPoint).toEqual(data.entryPoint);

		data = {
			id: "111222",
			gameCode,
			status: "prepare",
			region: "nodeServerEngine",
			exitCode: 123,
			modules: [
				{
					code: "someModule",
					values: { foo: "bar" },
				},
			],
			cost,
			processName,
			entryPoint,
		};
		instance = new Instance(data).toJSON();
		expect(instance.gameCode).toEqual(data.gameCode);
		expect(instance.id).toEqual(data.id);
		expect(instance.status).toEqual(data.status);
		testModule(instance.modules, data.modules);
		expect(instance.region).toEqual(data.region);
		expect(instance.exitCode).toEqual(data.exitCode);
		expect(instance.cost).toEqual(data.cost);
		expect(instance.processName).toEqual(data.processName);
		expect(instance.entryPoint).toEqual(data.entryPoint);
	});

	it("test-fromObject", () => {
		const data: InstanceLike = {
			id: "111222",
			gameCode,
			status: "prepare",
			region: "nodeServerEngine",
			exitCode: 123,
			modules: [
				{
					code: "someModule",
					values: { foo: "bar" },
				},
			],
			cost,
			processName,
			entryPoint,
		};
		const instance = Instance.fromObject(data);
		expect(instance.gameCode).toEqual(data.gameCode);
		expect(instance.id).toEqual(data.id);
		expect(instance.status).toEqual(data.status);
		testModule(instance.modules, data.modules);
		expect(instance.region).toEqual(data.region);
		expect(instance.exitCode).toEqual(data.exitCode);
		expect(instance.cost).toEqual(data.cost);
		expect(instance.processName).toEqual(data.processName);
		expect(instance.entryPoint).toEqual(data.entryPoint);

		const data2 = {
			gameCode,
			status: "prepare",
			region: "nodeServerEngine",
			modules: [
				{
					code: "someModule",
					values: { foo: "bar" },
				},
			],
			cost,
			entryPoint,
		};
		const instance2 = Instance.fromObject(data2);
		expect(instance2.gameCode).toEqual(data2.gameCode);
		expect(instance2.id).toBeUndefined();
		expect(instance2.status).toEqual(data2.status);
		testModule(instance2.modules, data2.modules);
		expect(instance2.region).toEqual(data2.region);
		expect(instance2.exitCode).toBeUndefined();
		expect(instance2.cost).toEqual(data2.cost);
		expect(instance2.processName).toBeUndefined();
		expect(instance2.entryPoint).toEqual(data2.entryPoint);
	});

	it("test-fromObject error", () => {
		// id が数値型に変換できない
		expect(() =>
			Instance.fromObject({
				id: "error-number",
				gameCode,
				status: "prepare",
				region: "nodeServerEngine",
				exitCode: 123,
				modules: [
					{
						code: "someModule",
						values: { foo: "bar" },
					},
				],
				cost,
				processName,
				entryPoint,
			}),
		).toThrow();

		// gameCode が url 使用可能な文字列じゃない
		expect(() =>
			Instance.fromObject({
				id: "12345",
				gameCode: "/game.code",
				status: "prepare",
				region: "nodeServerEngine",
				exitCode: 123,
				modules: [
					{
						code: "someModule",
						values: { foo: "bar" },
					},
				],
				cost,
				processName,
				entryPoint,
			}),
		).toThrow();

		// status がない
		expect(() =>
			Instance.fromObject({
				id: "12345",
				gameCode,
				region: "nodeServerEngine",
				exitCode: 123,
				modules: [
					{
						code: "someModule",
						values: { foo: "bar" },
					},
				],
				cost,
				processName,
				entryPoint,
			}),
		).toThrow();
		// status が文字列に変換できない
		expect(() =>
			Instance.fromObject({
				id: "12345",
				gameCode,
				status: { status: "キャストできない" },
				region: "nodeServerEngine",
				exitCode: 123,
				modules: [
					{
						code: "someModule",
						values: { foo: "bar" },
					},
				],
				cost,
				processName,
				entryPoint,
			}),
		).toThrow();

		// region がない
		expect(() =>
			Instance.fromObject({
				id: "12345",
				gameCode,
				status: "prepare",
				exitCode: 123,
				modules: [
					{
						code: "someModule",
						values: { foo: "bar" },
					},
				],
				cost,
				processName,
				entryPoint,
			}),
		).toThrow();
		// region が文字列に変換できない
		expect(() =>
			Instance.fromObject({
				id: "12345",
				gameCode,
				status: "prepare",
				region: { region: "キャストできない" },
				exitCode: 123,
				modules: [
					{
						code: "someModule",
						values: { foo: "bar" },
					},
				],
				cost,
				processName,
				entryPoint,
			}),
		).toThrow();

		// exitCode が数値に変換できない
		expect(() =>
			Instance.fromObject({
				id: "12345",
				gameCode,
				status: "prepare",
				region: "nodeServerEngine",
				exitCode: "shutdown",
				modules: [
					{
						code: "someModule",
						values: { foo: "bar" },
					},
				],
				cost,
				processName,
				entryPoint,
			}),
		).toThrow();

		// cost がない
		expect(() =>
			Instance.fromObject({
				id: "12345",
				gameCode,
				status: "prepare",
				region: "nodeServerEngine",
				exitCode: 123,
				modules: [
					{
						code: "someModule",
						values: { foo: "bar" },
					},
				],
				processName,
				entryPoint,
			}),
		).toThrow();
		// cost が数値に変換できない
		expect(() =>
			Instance.fromObject({
				id: "12345",
				gameCode,
				status: "prepare",
				region: "nodeServerEngine",
				exitCode: 123,
				modules: [
					{
						code: "someModule",
						values: { foo: "bar" },
					},
				],
				cost: "夜の銀座",
				processName,
				entryPoint,
			}),
		).toThrow();

		// processName が文字列に変換できない
		expect(() =>
			Instance.fromObject({
				id: "12345",
				gameCode,
				status: "prepare",
				region: "nodeServerEngine",
				exitCode: 123,
				modules: [
					{
						code: "someModule",
						values: { foo: "bar" },
					},
				],
				cost,
				processName: { processName: "キャストできない" },
				entryPoint,
			}),
		).toThrow();

		// entryPoint がない
		expect(() =>
			Instance.fromObject({
				id: "12345",
				gameCode,
				status: "prepare",
				region: "nodeServerEngine",
				exitCode: 123,
				modules: [
					{
						code: "someModule",
						values: { foo: "bar" },
					},
				],
				cost,
				processName,
			}),
		).toThrow();
		// entryPoint が文字列に変換できない
		expect(() =>
			Instance.fromObject({
				id: "12345",
				gameCode,
				status: "prepare",
				region: "nodeServerEngine",
				exitCode: 123,
				modules: [
					{
						code: "someModule",
						values: { foo: "bar" },
					},
				],
				cost,
				processName,
				entryPoint: { entryPoint: "キャストできない" },
			}),
		).toThrow();

		// オブジェクト型じゃない
		expect(() => Instance.fromObject(null)).toThrow();
		expect(() => Instance.fromObject("オブジェクトだよ")).toThrow();
	});
});
