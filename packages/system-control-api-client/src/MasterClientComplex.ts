import { NicoApiResponse } from "@akashic/rest-client-core";
import * as DataTypes from "@akashic/server-engine-data-types";
import MasterClient = require("./MasterClient");

export class MasterClientComplex {
	private _currentMaster = -1;
	private _clients: MasterClient[];

	/**
	 * @param baseUrls
	 */
	constructor(baseUrls: string[]) {
		this._clients = baseUrls.map((baseUrl) => new MasterClient(baseUrl));
	}

	/**
	 * インスタンスの状態を更新する
	 *
	 * PATCH /v1.0/instances/:idに対応する
	 *
	 * Errors
	 * * Bad Request マスターじゃない状態のサーバに対してリクエストを投げた
	 * * Invalid Parameter リクエストに間違いがある
	 * @param instanceId
	 * @param status
	 */
	public patchInstance(instanceId: string, status: string): Promise<NicoApiResponse<DataTypes.Instance>> {
		return this.checkMaster().then((masterIndex) => this.onErrorCheckFail(this._clients[masterIndex].patchInstance(instanceId, status)));
	}

	private checkMaster() {
		return Promise.all(
			this._clients.map((client, index) => {
				return client
					.isMaster()
					.then((response) => (response && response.data && response.data.isMaster ? index : -1))
					.catch(() => -1);
			}),
		).then((isMasterResults) => {
			const masterIndex = isMasterResults.filter((index) => index >= 0);
			if (masterIndex.length === 1) {
				// 複数master名乗るやつがいたらクラスタすごくぶっ壊れてるのでエラーにする。。。
				this._currentMaster = masterIndex[0];
				return Promise.resolve(this._currentMaster);
			} else {
				this._currentMaster = -1;
				return Promise.reject(new Error("master is not working now"));
			}
		});
	}
	/**
	 * エラーが起きたら接続先チェックやり直しを仕込む
	 */
	private onErrorCheckFail<T>(promise: Promise<T>): Promise<T> {
		return promise.catch((error) => {
			this._currentMaster = -1; // チェックをやり直す
			return Promise.reject(error);
		});
	}
}
