import Config from "config";
import * as Mysql from "mysql";
import { IDatabaseConfig, IDatabaseHost } from "../../Config";
import { Database } from "./";

describe("Database Feature", () => {
	// MySQL
	const hosts = Config.get<IDatabaseHost[]>("dbSettings.database.hosts");
	const hostName = hosts[0].host;
	const portNumber = hosts[0].port;
	const mysqlPool = Mysql.createPool({
		bigNumberStrings: true,
		supportBigNumbers: true,
		database: Config.get("dbSettings.database.database"),
		host: hostName,
		user: Config.get("dbSettings.database.user"),
		password: Config.get("dbSettings.database.password"),
		port: portNumber,
		charset: "utf8mb4",
		stringifyObjects: true,
	});

	beforeEach((done) => {
		// database migration について
		//  以下のタスクの後に、やり直しする
		//  1. db-migration リポジトリにあるやつをこっちに移行してくる
		//  2. Sequelize （=umzug） で migration と seeding をできるようにする
		//  3. 関数を呼び出せば migration & seeding できるようにする
		// とりあえず、この Spec ファイル内で使うであろう DataBase に対して、手動で Seeding する。
		// Redis について
		//  DB Flush で良い。
		mysqlPool.getConnection((connectionError, connection) => {
			if (connectionError) {
				done.fail(connectionError);
			}

			connection.query("DELETE FROM play_relations", (queryError) => {
				connection.release();
				if (queryError) {
					done.fail(queryError);
					return;
				}
				done();
				return;
			});
		});
	});

	describe("basic usage", () => {
		const model = new Database(mysqlPool);

		it("can CREATE & READ", async () => {
			const resultCreate = await model.store("1", "2", {});
			expect(resultCreate).toBe(true);

			// play id が 2 の Play の 親プレイと、その親プレから引き継がれるときのパーミッション
			const resultRead = await model.findByChild("2");
			expect(resultRead.get("1")).toEqual({});
		});
	});

	describe("basic usage with fromConfig factory", () => {
		const model = Database.fromConfig(Config.get<IDatabaseConfig>("dbSettings.database"));

		it("can CREATE & READ", async () => {
			const resultCreate = await model.store("1", "3", {});
			expect(resultCreate).toBe(true);

			// play id が 2 の Play の 親プレイと、その親プレから引き継がれるときのパーミッション
			const resultRead = await model.findByChild("3");

			expect(resultRead.get("1")).toEqual({});
		});
	});

	describe("before register,", () => {
		const model = new Database(mysqlPool);

		describe("find parent plays by child play", () => {
			it("should return empty Map", async () => {
				const value = await model.findByChild("9999");
				expect(value.size).toBe(0);
			});
		});
	});
});
