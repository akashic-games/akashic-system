import * as tapper from "../src";
import * as ConnectionFactory from "./ConnectionFactory";
import { setUp } from "./definitions/DbSetup";
import { Test, TypeTest } from "./records";

interface Queryable {
	query<T>(TClass: new () => T, sql: string, values?: any): Promise<T[]>;
}

describe("Query", () => {
	beforeAll(async () => {
		await setUp();
	});
	let queryables: Queryable[];
	beforeEach((done) => {
		queryables = [];
		const waits: Array<Promise<any>> = [];
		queryables.push(ConnectionFactory.getConnection());
		const pool = ConnectionFactory.getPool();
		queryables.push(pool);
		waits.push(
			pool.getConnection().then((connection) => {
				queryables.push(connection);
			}),
		);
		const cluster = ConnectionFactory.getPoolCluster();
		for (let i = 0; i < ConnectionFactory.hosts.length; ++i) {
			waits.push(cluster.getConnection().then((connection) => queryables.push(connection)));
		}
		Promise.all(waits)
			.then(() => done())
			.catch((error) =>
				setImmediate(() => {
					throw error;
				}),
			);
	});
	afterEach((done) => {
		ConnectionFactory.end()
			.then(() => done())
			.catch((_error) => done()); // 終了時のエラーは握りつぶし
	});
	it("test [Connection, Pool, PoolCluster]#query - normal pattern", (done) => {
		Promise.all(
			queryables.map((queryable) =>
				queryable
					.query(Test, "SELECT * from test WHERE id=1")
					.then((test) => {
						expect(test.length).toEqual(1);
						expect(test[0].id).toBe("1");
						expect(test[0].foo).toBe("hoge");
						expect(test[0].bar).toBe(1.1);
						expect(test[0].baz).toBe("1");
					})
					.then(() => queryable.query(Test, "SELECT * from test WHERE id = ?", ["2"]))
					.then((test) => {
						expect(test.length).toEqual(1);
						expect(test[0].id).toBe("2");
						expect(test[0].foo).toBe("fuga");
						expect(test[0].bar).toBeNull();
						expect(test[0].baz).toBe("9223372036854775807");
					}),
			),
		)
			.then(() => done())
			.catch((error) =>
				setImmediate(() => {
					throw error;
				}),
			);
	});
	it("test [Connection, Pool, PoolCluster]#query - type tests", (done) => {
		Promise.all(
			queryables.map((queryable) =>
				queryable.query(TypeTest, "SELECT * from typeTest WHERE fBigint=9223372036854775807").then((test) => {
					expect(test.length).toEqual(1);
					expect(test[0].fBigint).toBe("9223372036854775807");
					expect(test[0].fTynyint).toBe(1);
					expect(test[0].fSmallint).toBe(32767);
					expect(test[0].fMediumint).toBe(8388607);
					expect(test[0].fInt).toBe(2147483647);
					expect(test[0].fsInt).toBe("2147483647");
					expect(test[0].fnBigint).toBeNull();
					expect(test[0].fFloat).toBe(3.14);
					expect(test[0].fDouble).toBe(3.14159265358979);
					expect(test[0].fDate.getTime()).toEqual(new Date("2015-09-01T00:00:00+0900").getTime());
					expect(test[0].fDatetime.getTime()).toEqual(new Date("2015-09-01T12:34:56+0900").getTime());
					expect(test[0].fnDatetime).toBeNull();
					expect(new Date(test[0].fsDatetime).getTime()).toBe(new Date("2015-09-01T12:34:56+0900").getTime());
					expect(test[0].fTimestamp.getTime()).toEqual(new Date("2015-09-01T12:34:56+0900").getTime());
					expect(test[0].fTime).toBe("22:00:00");
					expect(test[0].fYear).toBe(2015);
					expect(test[0].fChar).toBe("hoge");
					expect(test[0].fVarchar).toBe("fuga");
					expect(test[0].fBinary.toString("hex")).toBe("7069796f000000000000000000000000");
					expect(test[0].fVarbinary.toString("hex")).toBe("6d6f796f");
					expect(test[0].fBlob.toString("hex")).toBe("626c6f62");
					expect(test[0].fText).toBe("text");
					expect(test[0].fEnum).toBe("baz");
				}),
			),
		)
			.then(() => done())
			.catch((error) =>
				setImmediate(() => {
					throw error;
				}),
			);
	});
	it("test [Connection, Pool, PoolCluster]#query - update query", (done) => {
		Promise.all(
			queryables.map((queryable, i) =>
				queryable
					.query(TypeTest, "INSERT test SET id=?,foo='piyo', baz=3", [i + 5])
					.then((_test) => {
						fail();
					})
					.catch((error: Error) => {
						expect(error.message).toBe("no field packet. may use query<T> for no response set query?");
					}),
			),
		)
			.then(() => done())
			.catch((error) =>
				setImmediate(() => {
					throw error;
				}),
			);
	});
	it("test [Connection, Pool, PoolCluster]#query - invalid query", (done) => {
		Promise.all(
			queryables.map((queryable) =>
				queryable
					.query(Test, "SEECT * from test WHERE id = 1")
					.then((_result) => fail())
					.catch((error: Error) => {
						expect(tapper.ErrorEvaluator.isParseError(error)).toBeTruthy();
					}),
			),
		)
			.then(() => done())
			.catch((error) =>
				setImmediate(() => {
					throw error;
				}),
			);
	});
	it("test [Connection, Pool, PoolCluster]#query - bad field", (done) => {
		Promise.all(
			queryables.map((queryable) =>
				queryable
					.query(Test, "SELECT * from test WHERE ida = 1")
					.then((_result) => fail())
					.catch((error: Error) => {
						expect(tapper.ErrorEvaluator.isBadFieldError(error)).toBeTruthy();
					}),
			),
		)
			.then(() => done())
			.catch((error) =>
				setImmediate(() => {
					throw error;
				}),
			);
	});
});
