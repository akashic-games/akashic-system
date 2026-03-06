import * as thrift from "thrift";
import * as Rx from "rx-lite";
import Timeout from "./Timeout";

export interface ConnectionOptions {
	host: string;
	port: number;
	timeout: number;
	retryCount?: number;
}
export interface ThriftModule<TClient> {
	Client: {
		new (output: thrift.TTransport, pClass: { new (trans: thrift.TTransport): thrift.TProtocol }): TClient;
	};
}
export abstract class ClientBase<TClient> {
	protected _options: ConnectionOptions;
	private _connection: thrift.Connection;
	private _client: TClient = null;
	private _thriftModule: ThriftModule<TClient>;

	constructor(thriftModule: ThriftModule<TClient>, options: ConnectionOptions) {
		this._thriftModule = thriftModule;
		this._options = options;
	}
	close(): void {
		this._client = null;
		if (this._connection) {
			this._connection.end();
			this._connection = null;
		}
	}
	protected getClient(): Promise<TClient> {
		if (this._client !== null) {
			return Promise.resolve(this._client);
		}
		return Rx.Observable.defer(() => this.getConnection())
			.retry(typeof this._options.retryCount === "number" ? this._options.retryCount : 5)
			.map((connection) => {
				this._connection = connection;
				this._client = thrift.createClient(this._thriftModule, connection);
				this._connection.on("close", () => {
					this._client = null;
					this._connection = null;
				});
				this._connection.on("error", () => {
					this._client = null;
					this._connection = null;
				});
				return this._client;
			})
			.toPromise<Promise<TClient>>(Promise);
	}
	protected timeout<T>(target: PromiseLike<T>, timeoutMessage: string, timeout?: number): Promise<T> {
		return Timeout(target, timeout ? timeout : this._options.timeout, timeoutMessage, () => this.close());
	}
	private getConnection(): Promise<thrift.Connection> {
		return new Promise<thrift.Connection>((resolve, reject) => {
			let connection = thrift.createConnection(this._options.host, this._options.port, {
				transport: thrift.TFramedTransport,
			});
			let connectCB: () => void;
			let errorCB: (err: any) => void;
			let timeoutHandler = setTimeout(() => errorCB(new Error("rpc connect timeout")), this._options.timeout);
			connectCB = () => {
				connection.removeListener("error", errorCB);
				clearTimeout(timeoutHandler);
				resolve(connection);
			};
			errorCB = (err) => {
				connection.removeListener("connect", connectCB);
				clearTimeout(timeoutHandler);
				reject(err);
			};
			connection.addListener("connect", connectCB);
			connection.addListener("error", errorCB);
		});
	}
}
