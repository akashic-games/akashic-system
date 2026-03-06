import * as tapper from "../src";
import * as ConnectionFactory from "./ConnectionFactory";
import { setUp } from "./definitions/DbSetup";
import { InsertTest } from "./records";

interface Executable {
	query<T>(TClass: new () => T, sql: string, values?: any): Promise<T[]>;
	execute(sql: string, values?: any): Promise<tapper.DataTypes.OkPacket>;
}

describe("Execute", () => {
	beforeAll(async () => {
		await setUp();
	});
	let executables: Executable[];
	beforeEach((done) => {
		executables = [];
		const waits: Array<Promise<any>> = [];
		executables.push(ConnectionFactory.getConnection());
		const pool = ConnectionFactory.getPool();
		executables.push(pool);
		waits.push(
			pool.getConnection().then((connection) => {
				executables.push(connection);
			}),
		);
		const cluster = ConnectionFactory.getPoolCluster();
		for (let i = 0; i < ConnectionFactory.hosts.length; ++i) {
			waits.push(cluster.getConnection().then((connection) => executables.push(connection)));
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
	it("test [Connection, Pool, PoolCluster]#execute - insert and get", (done) => {
		Promise.all(
			executables.map((executable, i) =>
				executable
					.execute("INSERT INTO insertTest (fValue, fUniq) VALUES('hoge', CAST(? as unsigned))", [i])
					.then((packet) => executable.query(InsertTest, "SELECT * from insertTest WHERE id = CAST(? AS unsigned)", [packet.insertId]))
					.then((test) => {
						expect(test.length).toEqual(1);
						expect(typeof test[0].id).toBe("string");
						expect(test[0].fValue).toBe("hoge");
						expect(test[0].fUniq).toBe(String(i));
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
	it("test [Connection, Pool, PoolCluster]#execute - select query", (done) => {
		Promise.all(
			executables.map((executable) =>
				executable
					.execute("SELECT * from insertTest WHERE id = 1")
					.then((_packet) => fail())
					.catch((error: Error) => {
						expect(error.message).toBe("no ok packet. may use execute for having response set query?");
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
	it("test [Connection, Pool, PoolCluster]#execute - dup key", (done) => {
		executables[0]
			.execute("INSERT INTO insertTest (fValue, fUniq) VALUES('fuga', 10000)")
			.then(() =>
				Promise.all(
					executables.map((executable) =>
						executable
							.execute("INSERT INTO insertTest (fValue, fUniq) VALUES('piyo', 10000)")
							.then((_packet) => fail())
							.catch((error: Error) => {
								expect(tapper.ErrorEvaluator.isMysqlError(new Error())).toBeFalsy();
								expect(tapper.ErrorEvaluator.isMysqlError(error)).toBeTruthy();
								expect(tapper.ErrorEvaluator.isDuplicateEntry(error)).toBeTruthy();
							}),
					),
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
