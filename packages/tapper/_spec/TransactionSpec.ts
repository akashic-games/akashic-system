import * as tapper from "../src";
import * as ConnectionFactory from "./ConnectionFactory";
import { setUp } from "./definitions/DbSetup";
import { InsertTest } from "./records";

describe("Transaction", () => {
	beforeAll(async () => {
		await setUp();
	});
	let poolCluster: tapper.PoolCluster;
	beforeEach(() => {
		poolCluster = ConnectionFactory.getPoolCluster();
	});
	afterEach((done) => {
		poolCluster
			.end()
			.then(() => done())
			.catch((_error) => done()); // 終了時のエラーは握りつぶし
	});
	it("origin test", (done) => {
		expect(poolCluster.origin).toBeTruthy();
		expect(ConnectionFactory.getPool().origin).toBeTruthy();
		poolCluster
			.getConnection()
			.then((connection) => {
				expect(connection.origin).toBeTruthy();
			})
			.then(() => done())
			.catch((error) =>
				setImmediate(() => {
					throw error;
				}),
			);
	});
	it("transaction test - commit", (done) => {
		Promise.all([poolCluster.getConnection(), poolCluster.getConnection()])
			.then((connections) => {
				const [conn1, conn2] = connections;
				let insertId: number;
				return conn1
					.beginTransaction()
					.then(() => conn1.execute("INSERT INTO insertTest (fValue, fUniq) VALUES('hoge', 12345)"))
					.then((packet) => {
						insertId = packet.insertId;
						return Promise.all([
							conn1.query(InsertTest, "SELECT * from insertTest WHERE id = CAST(? AS unsigned)", [insertId]),
							conn2.query(InsertTest, "SELECT * from insertTest WHERE id = CAST(? AS unsigned)", [insertId]),
						]);
					})
					.then((tuple) => {
						const [test1, test2] = tuple;
						expect(test1.length).toEqual(1);
						expect(typeof test1[0].id).toBe("string");
						expect(test1[0].fValue).toBe("hoge");
						expect(test1[0].fUniq).toBe("12345");
						expect(test2.length).toEqual(0);
					})
					.then(() => conn1.commit())
					.then(() =>
						Promise.all([
							conn1.query(InsertTest, "SELECT * from insertTest WHERE id = CAST(? AS unsigned)", [insertId]),
							conn2.query(InsertTest, "SELECT * from insertTest WHERE id = CAST(? AS unsigned)", [insertId]),
						]),
					)
					.then((tuple) => {
						const [test1, test2] = tuple;
						expect(test1.length).toEqual(1);
						expect(typeof test1[0].id).toBe("string");
						expect(test1[0].fValue).toBe("hoge");
						expect(test1[0].fUniq).toBe("12345");
						expect(test2.length).toEqual(1);
						expect(typeof test2[0].id).toBe("string");
						expect(test2[0].fValue).toBe("hoge");
						expect(test2[0].fUniq).toBe("12345");
					});
			})
			.then(() => done())
			.catch((error) =>
				setImmediate(() => {
					throw error;
				}),
			);
	});
	it("transaction test - rollback", (done) => {
		Promise.all([poolCluster.getConnection(), poolCluster.getConnection()])
			.then((connections) => {
				const [conn1, conn2] = connections;
				let insertId: number;
				return conn1
					.beginTransaction()
					.then(() => conn1.execute("INSERT INTO insertTest (fValue, fUniq) VALUES('hoge', 1)"))
					.then((packet) => {
						insertId = packet.insertId;
						return Promise.all([
							conn1.query(InsertTest, "SELECT * from insertTest WHERE id = CAST(? AS unsigned)", [insertId]),
							conn2.query(InsertTest, "SELECT * from insertTest WHERE id = CAST(? AS unsigned)", [insertId]),
						]);
					})
					.then((tuple) => {
						const [test1, test2] = tuple;
						expect(test1.length).toEqual(1);
						expect(typeof test1[0].id).toBe("string");
						expect(test1[0].fValue).toBe("hoge");
						expect(test1[0].fUniq).toBe("1");
						expect(test2.length).toEqual(0);
					})
					.then(() => conn1.rollback())
					.then(() =>
						Promise.all([
							conn1.query(InsertTest, "SELECT * from insertTest WHERE id = CAST(? AS unsigned)", [insertId]),
							conn2.query(InsertTest, "SELECT * from insertTest WHERE id = CAST(? AS unsigned)", [insertId]),
						]),
					)
					.then((tuple) => {
						const [test1, test2] = tuple;
						expect(test1.length).toEqual(0);
						expect(test2.length).toEqual(0);
					});
			})
			.then(() => done())
			.catch((error) =>
				setImmediate(() => {
					throw error;
				}),
			);
	});
});
