import * as dt from "@akashic/server-engine-data-types";
import difference = require("lodash.difference");
import { Client, Event, Exception, Stat } from "node-zookeeper-client";
import { TypedEventEmitter } from "../util/TypedEventEmitter";
import { AliveNode } from "./AliveNode";
import * as constants from "./constants";

interface MonitorEventMap {
	nodeLeaved: dt.ClusterIdentity;
	nodeJoined: dt.ClusterIdentity;
	error: Error;
}

export class Monitor extends TypedEventEmitter<MonitorEventMap> {
	private isConnected = false;
	private childrenCache: { [index: string]: string } = {}; // czxid のキャッシュ、znode 名 -> czxid
	private processes = new Map<string, AliveNode>();
	private _client: Client;
	constructor(client: Client) {
		super();
		this._client = client;
	}
	/**
	 * 監視機構を作動させる
	 *
	 * 返り値のPromiseは一回目のzookeeperからの取得・処理が完了するまで結果を返さない。
	 */
	public async connect(): Promise<void> {
		// 通常の監視設定&監視後の取得兼再設定
		const getChildren = async () => {
			try {
				const children = await new Promise<string[]>((resolve, reject) => {
					this._client.getChildren(
						constants.aliveMonitoringZPath,
						(event) => {
							if (event.type === Event.NODE_CHILDREN_CHANGED) {
								// 子ノード増減イベントが発火
								getChildren(); // 再取得とイベント再登録を実施する
							}
						},
						(error, children) => {
							if (error) {
								reject(error);
							} else {
								resolve(children);
							}
						},
					);
				});
				return this.onChildrenChanged(children);
			} catch (err) {
				if (err instanceof Exception) {
					if (err.getCode() === Exception.CONNECTION_LOSS || err.getCode() === Exception.OPERATION_TIMEOUT) {
						// 接続断イベント
						getChildren(); // 再取得を試みる
						return;
					}
				}
				// それ以外はエラーに落とす
				this.emit("error", err as Error); // node-zookeeper-client は class Exception extends Errorなのでキャスト可能(型定義には書かれてないが)
				throw err;
			}
		};
		this.isConnected = true;
		return getChildren();
	}
	/**
	 * ProcessIdentityに対応するClusterIdentityを取得する。
	 * 登録がなければundefinedを返す
	 */
	public resolveClusterIdentity(identity: dt.ProcessIdentityLike) {
		const aliveNode = this.processes.get(new dt.ProcessIdentity(identity).getKeyString());
		if (!aliveNode) {
			return undefined;
		}
		return aliveNode.identity;
	}
	/**
	 * 現在存在するすべてのノードのClusterIdentityを取得する
	 */
	public getAllNodes(): dt.ClusterIdentity[] {
		const result: dt.ClusterIdentity[] = [];
		this.processes.forEach((process) => result.push(process.identity));
		return result;
	}

	/**
	 * 有効なznode追加時の処理
	 */
	private onAliveZNodeAdded(aliveNodes: (AliveNode | null)[]) {
		if (!this.isConnected) {
			return;
		}
		for (const aliveNode of aliveNodes) {
			if (!aliveNode) {
				continue;
			}
			this.processes.set(new dt.ProcessIdentity(aliveNode.identity).getKeyString(), aliveNode);
			this.emit("nodeJoined", aliveNode.identity);
		}
	}

	private onAliveZNodeDeleted(childNames: string[]) {
		if (!this.isConnected) {
			return;
		}
		for (const childName of childNames) {
			const aliveNode = this.processes.get(childName);
			if (!aliveNode) {
				continue;
			}
			this.processes.delete(new dt.ProcessIdentity(aliveNode.identity).getKeyString());
			this.emit("nodeLeaved", aliveNode.identity);
		}
	}

	/**
	 * 変更があったら変更イベントを発火させる
	 */
	private async onChildrenChanged(children: string[]): Promise<void> {
		const added = difference(children, Object.keys(this.childrenCache));
		const deleted = difference(Object.keys(this.childrenCache), children);
		deleted.forEach((deletedNode) => {
			delete this.childrenCache[deletedNode];
		});
		// 非同期処理を入れて、connectの完了時には1回目のreadが終わっている状況にする
		const childNodes = await Promise.all(children.map((childName) => this.resolveAliveNode(childName)));
		// zookeeper の接続断/再接続が起こったときは、全ての離脱/参加のイベント通知が起きているとは限らず、
		// node 構成に変更がなくても czxid が変更されていることがある。
		// 現在の znode czxid の値とキャッシュの値を比較して、変更されている場合は離脱/参加が行われたものとして扱う。
		childNodes.forEach((childNode, index) => {
			if (!childNode) {
				return;
			}
			const name = children[index];
			if (this.childrenCache[name] && childNode.identity.czxid !== this.childrenCache[name]) {
				deleted.push(name);
				added.push(name);
			}
			this.childrenCache[name] = childNode.identity.czxid;
		});
		const addedNodes = await Promise.all<AliveNode>(added.map((addedName) => this.resolveAliveNode(addedName)));
		this.onAliveZNodeDeleted(deleted);
		this.onAliveZNodeAdded(addedNodes);
	}
	/**
	 * 子プロセス名からznode情報を取得する
	 */
	private async resolveAliveNode(childName: string): Promise<AliveNode | null> {
		const path = constants.aliveMonitoringZPath + "/" + childName;
		try {
			const [stat, data] = await new Promise<[Stat, Buffer]>((resolve, reject) => {
				this._client.getData(path, (error, data, stat) => {
					if (error) {
						reject(error);
					} else {
						resolve([stat, data]);
					}
				});
			});
			const jsonString = data.toString("utf-8");
			const identity: dt.ProcessIdentity = dt.ProcessIdentity.fromObject(JSON.parse(jsonString));
			// czxidはBuffer(big endian int64)なのでBufferからstringに変換する
			const czxid_str = BigInt(`0x${stat.czxid.toString("hex")}`).toString();
			const result_1: AliveNode = new AliveNode(identity, path, czxid_str);
			return result_1;
		} catch {
			return null;
		}
	}
}
