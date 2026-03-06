import config from "config";
import * as tapper from "./";

export const hosts = config.get<string[]>("database.hosts");
const user = config.get<string>("database.user");
const password = config.get<string>("database.password");
const database = "__test_tapper";

const endables: { end(): Promise<void> }[] = [];
export function getConnection() {
	const connection = tapper.createConnection({
		host: hosts[0],
		user,
		password,
		database,
		charset: "utf8mb4",
		supportBigNumbers: true,
		bigNumberStrings: true,
	});
	endables.push(connection);
	return connection;
}

export function getPool() {
	const pool = tapper.createPool({
		host: hosts[0],
		user,
		password,
		database,
		charset: "utf8mb4",
		supportBigNumbers: true,
		bigNumberStrings: true,
		dateStrings: true,
	});
	endables.push(pool);
	return pool;
}

export function getPoolCluster() {
	const cluster = tapper.createPoolCluster();
	for (const host of hosts) {
		cluster.add({
			host,
			user,
			password,
			database,
			charset: "utf8mb4",
			supportBigNumbers: true,
			bigNumberStrings: true,
		});
	}
	endables.push(cluster);
	return cluster;
}

export function end() {
	return Promise.all(endables.map((endable) => endable.end()));
}
