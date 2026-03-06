import * as mysql from "mysql";
import Connection from "./Connection";
export import DataTypes = require("./DataTypes");
export import ErrorEvaluator = require("./ErrorEvaluator");
import Pool from "./Pool";
import PoolCluster from "./PoolCluster";
export { default as Connection } from "./Connection";
export { default as Pool } from "./Pool";
export { default as PoolCluster } from "./PoolCluster";
export import Annotations = require("./Annotations");

/**
 * Connectionを作成する
 */
export function createConnection(uriOrConfig: string | mysql.ConnectionConfig): Connection {
	return new Connection(mysql.createConnection(uriOrConfig));
}

/**
 * ConnectionPoolを作成する
 */
export function createPool(config: mysql.PoolConfig): Pool {
	return new Pool(mysql.createPool(config));
}

/**
 * ConnectionPoolClusterを作成する
 */
export function createPoolCluster(config?: mysql.PoolClusterConfig): PoolCluster {
	return new PoolCluster(mysql.createPoolCluster(config));
}

export function escape(value: any, stringifyObjects?: boolean, timeZone?: string): string {
	return mysql.escape(value, stringifyObjects, timeZone);
}

export function format(sql: string, values: any[]): string {
	return mysql.format(sql, values);
}
