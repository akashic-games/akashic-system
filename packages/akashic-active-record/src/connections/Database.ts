import * as tapper from "@akashic/tapper";
import { ConnectionFactory } from "./ConnectionFactory";
import { DatabaseConfig } from "./DatabaseConfig";
import { Repositories } from "./Repositories";

export class Database {
	get repositories(): Repositories {
		return this._repositories;
	}

	public static createConnection(dbconf: DatabaseConfig): Promise<Database> {
		const factory = new ConnectionFactory(dbconf, dbconf.pool);
		return Promise.resolve(new Database(factory));
	}
	private _factory: ConnectionFactory;
	private _repositories: Repositories;
	constructor(factory: ConnectionFactory) {
		this._factory = factory;
		this._repositories = new Repositories(factory);
	}
	public transaction<T>(inTransactionProcess: (connection: tapper.Connection) => T | Promise<T>): Promise<T> {
		return this._factory.getConnection().then<T>((connection) =>
			connection
				.beginTransaction()
				.then(() => inTransactionProcess(connection))
				.then((result) =>
					connection
						.commit()
						.then(() => this._factory.release(connection))
						.then(() => result),
				)
				.catch((error) =>
					connection
						.rollback()
						.then(() => this._factory.release(connection))
						.catch((_e): undefined => undefined) // 切断時のエラーは握りつぶす
						.then(() => Promise.reject(error)),
				),
		);
	}
	public end(): Promise<void> {
		return this._factory.end();
	}
}
