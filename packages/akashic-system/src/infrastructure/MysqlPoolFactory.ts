import * as Mysql from "mysql";
import { IDatabaseConfig } from "../Config";

export class MysqlPoolFactory {
	public static fromConfig(config: IDatabaseConfig): Mysql.Pool {
		const host = config.hosts[0];

		// build
		const result: Mysql.PoolConfig = {
			bigNumberStrings: true,
			supportBigNumbers: true,
			database: config.database,
			host: host.host,
			user: config.user,
			password: config.password,
			port: host.port,
			charset: "utf8mb4",
			stringifyObjects: true, // anti SQL Injection
			connectionLimit: config.poolConnectionLimit || 10,
			waitForConnections: config.poolWaitForConnections || true,
			queueLimit: config.poolQueueLimit || 0,
		};

		return Mysql.createPool(result);
	}
}
