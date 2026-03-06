import config from "config";
import * as fs from "fs";
import * as mysql from "mysql";
import * as path from "path";

export async function setUp(): Promise<void> {
	const host = config.get<string[]>("database.hosts")[0];
	const user = config.get<string>("database.user");
	const password = config.get<string>("database.password");

	const sqlfile = path.resolve(path.join("spec", "definitions", "setup.sql"));
	const sql = fs.readFileSync(sqlfile).toString();

	const connection = mysql.createConnection({
		host,
		user,
		password,
		multipleStatements: true,
	});

	await new Promise((resolve, reject) => {
		connection.query(sql, (err, _result) => {
			if (err) {
				return reject(err);
			}
			resolve();
		});
	});
}
