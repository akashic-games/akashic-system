import * as dt from "@akashic/server-engine-data-types";
import { Client, Event, Exception } from "node-zookeeper-client";
import { TypedEventEmitter } from "../util/TypedEventEmitter";
import * as constants from "./constants";

interface MasterEndpointEventMap {
	/**
	 * masterの接続先の変更を取得する。接続先が不明の時はnull
	 */
	changed: dt.Endpoint | null;
	/**
	 * エラー発生時
	 */
	error: Error;
}

/**
 * 現在のmasterの接続先を管理するクラス
 */
export class MasterEndpoint extends TypedEventEmitter<MasterEndpointEventMap> {
	private _client: Client;
	private _current: dt.Endpoint | null = null;

	/**
	 * 現在のmasterの接続先を取得する。接続先が不明の時はnull
	 */
	get current(): dt.Endpoint | null {
		return this._current;
	}
	constructor(client: Client) {
		super();
		this._client = client;
	}
	public async connect(): Promise<void> {
		const watch = async () => {
			try {
				return new Promise<void>((resolve, reject) => {
					this._client.exists(
						constants.masterSeatZPath,
						(event) => {
							// nodeに変更があれば
							if (event.type === Event.NODE_CREATED || event.type === Event.NODE_DATA_CHANGED || event.type === Event.NODE_DELETED) {
								// 接続先を再取得する
								watch()
									.then(() => this.refresh())
									.catch((err) => this.emit("error", err));
							}
						},
						(error) => {
							// このドライバはexistsではZNONODEエラーを飛ばさないので、そのまま対応
							if (error) {
								reject(error);
							} else {
								resolve();
							}
						},
					);
				});
			} catch (err) {
				if (err instanceof Exception) {
					if (err.code === Exception.CONNECTION_LOSS || err.code === Exception.OPERATION_TIMEOUT) {
						// 接続断イベント
						watch(); // 再取得を試みる
						return;
					}
				}
				// それ以外はエラーに落とす
				this.emit("error", err as Error);
				throw err;
			}
		};
		await watch();
		return await this.refresh();
	}
	private async refresh(): Promise<void> {
		try {
			const data = await new Promise<Buffer>((resolve, reject) => {
				this._client.getData(constants.masterSeatZPath, (error, data) => {
					if (error) {
						reject(error);
					} else {
						resolve(data);
					}
				});
			});
			const endpoint = dt.Endpoint.fromBuffer(data);
			this.setCurrent(endpoint);
		} catch (err) {
			if (err instanceof Exception && err.code === Exception.NO_NODE) {
				this.setCurrent(null);
				return;
			}
			throw err;
		}
	}
	private setCurrent(newCurrent: dt.Endpoint | null) {
		if (this._current === null || newCurrent === null) {
			if (this._current !== newCurrent) {
				this._current = newCurrent;
				this.emit("changed", this._current);
			}
		} else if (this._current.fqdn.value !== newCurrent.fqdn.value || this._current.port !== newCurrent.port) {
			this._current = newCurrent;
			this.emit("changed", this._current);
		}
	}
}
