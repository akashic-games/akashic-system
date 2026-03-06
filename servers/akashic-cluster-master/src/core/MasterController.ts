import * as dataTypes from "@akashic/server-engine-data-types";
import { Client, CreateMode, Event, Exception, Stat, State } from "node-zookeeper-client";
import { TypedEventEmitter } from "../util/TypedEventEmitter";
import * as constants from "./constants";
import { MasterStatus } from "./MasterStatus";

interface MasterControllerEventMap {
	masterStatusChanged: MasterStatus;
}

export class MasterController extends TypedEventEmitter<MasterControllerEventMap> {
	private _client: Client;
	private _masterStatus: MasterStatus = MasterStatus.notMaster;
	private _endPoint?: dataTypes.Endpoint;
	get isMaster() {
		return this._masterStatus === MasterStatus.master;
	}
	get masterStatus(): MasterStatus {
		return this._masterStatus;
	}
	constructor(client: Client) {
		super();
		this._client = client;
		this._client.on("connected", () => {
			// 再接続に成功
			if (this._masterStatus === MasterStatus.reChecking) {
				// 再チェック中だった場合
				this.checkMaster() // masterかどうか確認しに行く
					.catch(() => false) // エラーがあったらロック期限切れ
					.then((result) => {
						// 結果、ロックがとれていればmasterに復帰。そうでない場合はマスター権限喪失
						this.setMasterStatus(result ? MasterStatus.master : MasterStatus.fatal);
					});
			}
		});
		this._client.on("disconnected", () => {
			if (this._masterStatus === MasterStatus.master) {
				// masterだった場合は再チェック中に変更
				this.setMasterStatus(MasterStatus.reChecking);
			}
		});
		this._client.on("state", (state) => {
			if (state === State.EXPIRED || state === State.AUTH_FAILED) {
				// zookeeperの接続断→致命的エラー
				this.setMasterStatus(MasterStatus.fatal);
			}
		});
	}

	/**
	 * クラスタのノードを生成する
	 */
	public initClusterNodes(): Promise<void> {
		return new Promise<void>((resolve, reject) =>
			this._client.mkdirp(constants.aliveMonitoringZPath, (error) => (error ? reject(error) : resolve(undefined))),
		);
	}

	/**
	 * マスターとして立候補する
	 */
	public tryGetMasterPost(myEndpoint: dataTypes.Endpoint): Promise<boolean> {
		if (this._endPoint) {
			throw new Error("cannot try get master post twice");
		}
		this._endPoint = myEndpoint;
		return this._tryGetMasterPost();
	}

	/**
	 * マスターを自発的に降りる (znode を消去し、状態を fatal にする)
	 */
	public async demoteMasterPost(): Promise<void> {
		if (this._masterStatus !== MasterStatus.master) {
			return Promise.reject(new Error("not master"));
		}
		const stat = await new Promise<Stat | null>((resolve, reject) => {
			this._client.exists(constants.masterSeatZPath, (error, stat) => {
				if (error) {
					reject(error);
				} else {
					resolve(stat);
				}
			});
		});
		if (!stat) {
			return;
		}

		await new Promise<void>((resolve, reject) => {
			this._client.remove(constants.masterSeatZPath, stat.cversion, (error) => {
				if (error) {
					reject(error);
				} else {
					resolve();
				}
			});
		});
		return this.setMasterStatus(MasterStatus.fatal);
	}

	private async _tryGetMasterPost(): Promise<boolean> {
		if (this._masterStatus === MasterStatus.fatal) {
			return false;
		}
		if (this._endPoint == null) {
			throw new Error("_endPoint is null or undefined. This is Logic Exception.");
		}
		const path = constants.masterSeatZPath;

		try {
			// masterノードの作成を試みる
			await new Promise<void>((resolve, reject) => {
				this._client.create(path, this._endPoint!.toBuffer(), CreateMode.EPHEMERAL, (error) => {
					if (error) {
						reject(error);
					} else {
						resolve();
					}
				});
			});
			// master昇格に成功した？のチェック
			// fatalになっていたら失敗扱い(fatalになっているのでアプリケーションはじきに終了する)
			if ((this._masterStatus as MasterStatus) === MasterStatus.fatal) {
				return false; // しかしfatalになってるので失敗したことにする。
			}
			// masterに昇格
			this.setMasterStatus(MasterStatus.master);
			return true; // 昇格成功
		} catch (err) {
			if (err instanceof Exception) {
				if (err.getCode() === Exception.CONNECTION_LOSS || err.getCode() === Exception.OPERATION_TIMEOUT) {
					// 作成したけど切断した？
					// masterが自分自身かのチェックをかける
					const checkMasterResult = await this.checkMaster();
					if (checkMasterResult) {
						// とれたけど切断したケース
						return true;
					}
					return this.runAsSubMaster(); // 昇格待ち(ノード無しの場合はこれですぐ昇格する)
				} else if (err.getCode() === Exception.NODE_EXISTS) {
					// すでにノードがあったので、昇格待ちになる
					return this.runAsSubMaster();
				}
			}
			throw err;
		}
	}
	/**
	 * 自身が今masterかどうかチェックする
	 */
	private async checkMaster(): Promise<boolean> {
		const path = constants.masterSeatZPath;
		if (!this._endPoint || this._masterStatus === MasterStatus.notMaster || this._masterStatus === MasterStatus.fatal) {
			return false;
		}
		// リトライありでzookeeperからデータ取得
		let stat: Stat | null = null;
		let lastError: Error | null = null;
		const maxRetryCount = 5;
		for (let retryCount = 0; retryCount < maxRetryCount; ++retryCount) {
			try {
				stat = await new Promise<Stat>((resolve, reject) => {
					this._client.exists(path, (error, stat) => {
						if (error) {
							reject(error);
						} else {
							resolve(stat);
						}
					});
				});
				// ノード無しはそもそも自分がマスターではない
				if (!stat) {
					return false;
				}
				// ノードがあるのでstatを採用
				break;
			} catch (e) {
				if (e instanceof Exception) {
					if (e.getCode() === Exception.CONNECTION_LOSS || e.getCode() === Exception.OPERATION_TIMEOUT) {
						// CONNECTION_LOSSはリトライさせる
						lastError = e as unknown as Error;
						continue;
					}
				}
				throw e;
			}
		}
		if (!stat) {
			throw lastError;
		}
		// ノードのセッションIDが自分のセッションIDと一致していれば自分がマスター
		// どっちもbig endianな64bit longなので、bigint変換して比較する
		const nodeOwnerId = BigInt("0x" + stat.ephemeralOwner.toString("hex"));
		const sessionId = BigInt("0x" + this._client.getSessionId().toString("hex"));
		return nodeOwnerId === sessionId;
	}
	/**
	 * バックアップmasterとしての待機及び昇格作業
	 * すぐに昇格に成功すればtrueを返す。昇格待に成功すればfalseを返す(tryGetMasterPostと合わせるため)
	 */
	private runAsSubMaster(): Promise<boolean> {
		if (this._masterStatus !== MasterStatus.notMaster && this._masterStatus !== MasterStatus.subMaster) {
			// 立候補できない状態なので、何もしない
			return Promise.resolve(false);
		}
		this.setMasterStatus(MasterStatus.subMaster); // submasterになる
		const path = constants.masterSeatZPath;
		const doSubMaster: () => Promise<boolean> = async () => {
			try {
				const exists = await new Promise<boolean>((resolve, reject) => {
					this._client.exists(
						path,
						(event) => {
							if (event.type === Event.NODE_DELETED) {
								// Master だったノードが消滅したので再実行する
								this._tryGetMasterPost();
							} else if (
								event.type === Event.NODE_DATA_CHANGED ||
								event.type === Event.NODE_CHILDREN_CHANGED ||
								event.type === Event.NODE_CREATED
							) {
								// 再監視が必要なイベント
								doSubMaster() // 再監視実施
									.catch(() => {
										// 不明なエラーが再監視で置きてしまったので、fatalにする
										// Logger に差し替える
										// console.error("MasterController::subMaster routine got error: %s", err);
										this.setMasterStatus(MasterStatus.fatal);
									});
							}
						},
						(error, stat) => {
							if (error) {
								reject(error);
							} else {
								resolve(Boolean(stat));
							}
						},
					);
				});
				// あれ？マスターnode消えてる？
				if (!exists) {
					return this._tryGetMasterPost(); // 何故か消えてたので、昇格を試みる
				}
				return false;
			} catch (err) {
				if (err instanceof Exception) {
					if (err.getCode() === Exception.CONNECTION_LOSS || err.getCode() === Exception.OPERATION_TIMEOUT) {
						return doSubMaster(); // コネクションエラー系は再監視実施
					}
				}
				throw err;
			}
		};
		return doSubMaster();
	}
	/**
	 * マスター確保状況を変更する
	 */
	private setMasterStatus(newStatus: MasterStatus) {
		this._masterStatus = newStatus;
		this.emit("masterStatusChanged", this._masterStatus);
		if (this._masterStatus === MasterStatus.fatal) {
			this.removeAllListeners("masterStatusChanged");
		}
	}
}
