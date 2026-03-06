import * as nodePath from "path";
import { ZookeeperDataSource } from "../entities/ZookeeperDataSource";
import * as ZookeeperUtil from "./ZookeeperUtil";
import { CreateMode, Client, Stat } from "node-zookeeper-client";

/**
 * Zookeeper リポジトリ
 * - connect/disconnect() メソッドを持つが、通常は使用する必要はない。
 *   - connect() を明示的に呼び出ししない場合は初回操作時に接続する
 *   - disconnect() を明示的に呼び出ししない限り接続を保持し続ける
 */
export class ZookeeperRepository {
	public _dataSource: ZookeeperDataSource;
	public _client: Client | undefined;

	constructor(dataSource: ZookeeperDataSource) {
		this._dataSource = dataSource;
		this._client = undefined;
	}

	public async connect(): Promise<void> {
		if (this.connected()) {
			return Promise.resolve();
		}
		const client = await ZookeeperUtil.resolveClient(this._dataSource);
		this._client = client;
	}

	public disconnect(): void {
		if (this._client) {
			this._client.close();
			this._client = undefined;
		}
	}

	public connected(): boolean {
		return !!this._client;
	}

	/**
	 * @param path Znode path
	 * @param data The maximum allowable size of the data array is 1 MB (1,048,576 bytes).
	 * @param options {madeParent: see createParentNode(), isEphemeral: made ephemeral node}
	 * @return The actual path of the created node
	 */
	public async createData(path: string, data: Buffer | string, options?: { madeParent?: boolean; isEphemeral?: boolean }): Promise<string> {
		const opts = options || {};
		const bufferData = typeof data === "string" ? Buffer.from(data) : data;
		const mode = !!opts.isEphemeral ? CreateMode.EPHEMERAL : CreateMode.PERSISTENT;
		const prepare = !!opts.madeParent ? this.createParentNode(path) : this.connect();
		await prepare;
		return new Promise((resolve, reject) => {
			const client = this._client;
			if (!client) {
				reject(new Error("client is not connected"));
				return;
			}
			client.create(path, bufferData, mode, (error, path_2) => {
				if (error) {
					reject(error);
				} else {
					resolve(path_2);
				}
			});
		});
	}

	public async createParentNode(path: string): Promise<void> {
		await this.connect();
		return new Promise<void>((resolve, reject) => {
			const client = this._client;
			if (!client) {
				reject(new Error("client is not connected"));
				return;
			}
			client.mkdirp(nodePath.resolve(path, "../"), (error) => {
				if (error) {
					reject(error);
				} else {
					resolve();
				}
			});
		});
	}

	public async delete(path: string, version?: number): Promise<void> {
		await this.connect();
		return new Promise<void>((resolve, reject) => {
			const client = this._client;
			if (!client) {
				reject(new Error("client is not connected"));
				return;
			}
			client.remove(path, typeof version === "number" ? version : -1, (error) => {
				if (error) {
					reject(error);
				} else {
					resolve();
				}
			});
		});
	}

	public async stat(path: string): Promise<Stat | null> {
		await this.connect();
		return new Promise((resolve, reject) => {
			const client = this._client;
			if (!client) {
				reject(new Error("client is not connected"));
				return;
			}
			client.exists(path, (error, stat) => {
				if (error) {
					reject(error);
				} else {
					resolve(stat);
				}
			});
		});
	}

	public async exists(path: string): Promise<boolean> {
		const s = await this.stat(path);
		return !!s;
	}

	public async setData(path: string, data: Buffer | string, version?: number): Promise<Stat> {
		await this.connect();
		return new Promise((resolve, reject) => {
			const client = this._client;
			if (!client) {
				reject(new Error("client is not connected"));
				return;
			}
			const bufferData = typeof data === "string" ? Buffer.from(data) : data;
			client.setData(path, bufferData, typeof version === "number" ? version : -1, (error, stat) => {
				if (error) {
					reject(error);
				} else {
					resolve(stat);
				}
			});
		});
	}

	public async getChildren(path: string): Promise<string[]> {
		await this.connect();
		return new Promise((resolve, reject) => {
			// node-zookeeper-clientへの置き換えに伴い、ワークアラウンドを一旦削除
			// 再発するようなら復活させること
			// // 本番環境でのみ再現する不具合のワークアラウンド。
			// // なぜこれで直るのかは不明。いわゆる、「このコメントを入れるとなぜか動く」系のもの。
			// (this._client as ZooKeeper).a_get_children("/", false, () => {
			// 	// nothing to do
			// });

			const client = this._client;
			if (!client) {
				reject(new Error("client is not connected"));
				return;
			}
			client.getChildren(path, (error, children) => {
				if (error) {
					reject(error);
				} else {
					resolve(children);
				}
			});
		});
	}

	public async getData(path: string): Promise<string> {
		await this.connect();
		return new Promise((resolve, reject) => {
			const client = this._client;
			if (!client) {
				reject(new Error("client is not connected"));
				return;
			}
			client.getData(path, (error, data) => {
				if (error) {
					reject(error);
				} else {
					resolve(data.toString("utf-8"));
				}
			});
		});
	}

	public async getJson(path: string): Promise<any> {
		const data = await this.getData(path);
		try {
			return JSON.parse(data);
		} catch (e) {
			return Promise.reject("invalid data:" + data);
		}
	}

	public async getObject<T>(path: string, instantiate: (json: any) => T): Promise<T> {
		const json = await this.getJson(path);
		return instantiate(json);
	}
}
