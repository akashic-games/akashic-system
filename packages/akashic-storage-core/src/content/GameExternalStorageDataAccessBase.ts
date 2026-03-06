import {
	DEFAULT_STORAGE_READ_REQUEST_LIMIT,
	DEFAULT_STORAGE_READ_REQUEST_OFFSET,
	GameExternalStorageLocator,
	GameExternalStorageReadRequest,
	GameExternalStorageReadResponse,
	GameExternalStorageTransactionRequest,
	GameExternalStorageWriteFailureInfo,
	GameExternalStorageWriteRequest,
	GameExternalStorageWriteResponse,
	StorageData,
	StoragePlayScope,
	StorageValue,
	StorageValueType,
} from "@akashic/content-storage-types";

/**
 * コンテンツストレージの保存と取得等を行う
 */
export abstract class GameExternalStorageDataAccessBase {
	read(
		req: GameExternalStorageReadRequest,
		callback: (error: Error | null, response: GameExternalStorageReadResponse | null) => void,
	): void {
		(async () => {
			await this.doRead(req, callback);
		})();
	}

	write(
		req: GameExternalStorageWriteRequest,
		callback: (error: Error | null, response: GameExternalStorageWriteResponse | null) => void,
	): void {
		(async () => {
			await this.doWrite(req, callback);
		})();
	}

	protected async doRead(
		req: GameExternalStorageReadRequest,
		callback: (error: any, response: GameExternalStorageReadResponse | null) => void,
	): Promise<void> {
		try {
			if (!req) {
				throw new TypeError("req is empty.");
			}

			if (!GameExternalStorageDataAccessBase.checkReadRequestParameter(req)) {
				throw new TypeError("invalid read storage parameter.");
			}

			if (req.order) {
				callback(null, await this.doReadOrder(req));
				return;
			} else if (req.rankOfPlayerId) {
				callback(null, await this.doReadRank(req));
				return;
			} else {
				callback(null, await this.doReadPlayers(req));
				return;
			}
		} catch (error: any) {
			callback(error, null);
			return;
		}
	}

	protected async doWrite(
		req: GameExternalStorageWriteRequest,
		callback: (error: any, response: GameExternalStorageWriteResponse | null) => void,
	): Promise<void> {
		try {
			if (!req) {
				throw new TypeError("req is empty.");
			}

			if (!GameExternalStorageDataAccessBase.checkWriteRequestParameter(req)) {
				throw new TypeError("invalid write storage parameter.");
			}

			if (req.type === "ordered-number") {
				callback(null, await this.doWriteOrder(req));
			} else {
				callback(null, await this.doWritePlayers(req));
			}
		} catch (error: any) {
			callback(error, null);
			return;
		}
	}

	/**
	 * gameCodeを取得する。
	 *
	 * runnerProcess からの取得にも対応できるように、 protected にしておく。
	 */
	protected getGameCode(req: GameExternalStorageLocator | GameExternalStorageTransactionRequest): string {
		if (!req.gameCode) {
			throw new TypeError("invalid game code.");
		}
		return req.gameCode;
	}

	/**
	 * playScope から playScopeKey に変換する
	 *
	 * runnerProcess からの変換にも対応できるように、 protected にしておく。
	 */
	protected convertPlayScopeToKey(playScope: StoragePlayScope, req?: any): string | null {
		if (playScope === "global") {
			return "global";
		} else if (req && req.playId) {
			return req.playId;
		} else {
			return null;
		}
	}

	protected createStorageKeyPrefix(req: GameExternalStorageLocator | GameExternalStorageTransactionRequest): string {
		return `{${this.getGameCode(req)}}`;
	}

	protected createStorageKey(req: GameExternalStorageLocator): string {
		const playScope: StoragePlayScope = GameExternalStorageDataAccessBase.getPlayScope(req);
		const playScopeKey = this.convertPlayScopeToKey(playScope, req);
		if (!playScopeKey) {
			throw new TypeError(`request playScope (${req.playScope}) is not available.`);
		}

		return `${this.createStorageKeyPrefix(req)}:${playScopeKey}:${req.key}`;
	}

	protected static getPlayScope(req: GameExternalStorageLocator): StoragePlayScope {
		return req.playScope ? req.playScope : "global";
	}

	protected abstract storageMget(keys: string[]): Promise<string[]>;
	protected abstract storageMset(keys: string[], values: string[]): Promise<void>;
	protected abstract storageZadd(key: string, members: string[], scores: number[]): Promise<void>;
	protected abstract storageZrange(key: string, start: number, end: number): Promise<string[]>;
	protected abstract storageZrank(key: string, rankOfPlayerId: string): Promise<string>;

	private async doReadPlayers(req: GameExternalStorageReadRequest): Promise<GameExternalStorageReadResponse> {
		const gameCode: string = this.getGameCode(req);
		const storageKey: string = this.createStorageKey(req);
		const keys: string[] = [];
		for (const playerId of req.playerIds) {
			keys.push(`${storageKey}:${playerId}`);
		}

		const result: string[] = await this.storageMget(keys);
		if (!result || req.playerIds.length !== result.length) {
			throw new Error("invalid read storage result.");
		}

		const readResponse: GameExternalStorageReadResponse = {
			gameCode,
			playScope: GameExternalStorageDataAccessBase.getPlayScope(req),
			key: req.key,
			type: req.type,
			data: [],
		};

		for (let i: number = 0; i < req.playerIds.length; i++) {
			readResponse.data.push({
				playerId: req.playerIds[i],
				value: GameExternalStorageDataAccessBase.convertValueType(result[i], req.type),
			});
		}

		return readResponse;
	}

	private async doReadRank(req: GameExternalStorageReadRequest): Promise<GameExternalStorageReadResponse> {
		const gameCode: string = this.getGameCode(req);

		const result: string = await this.storageZrank(this.createStorageKey(req), req.rankOfPlayerId);

		const readResponse: GameExternalStorageReadResponse = {
			gameCode,
			playScope: GameExternalStorageDataAccessBase.getPlayScope(req),
			key: req.key,
			type: req.type,
			data: [],
		};

		readResponse.data.push({
			playerId: req.rankOfPlayerId,
			value: GameExternalStorageDataAccessBase.convertValueType(result, req.type),
		});

		return readResponse;
	}

	private async doReadOrder(req: GameExternalStorageReadRequest): Promise<GameExternalStorageReadResponse> {
		const gameCode: string = this.getGameCode(req);
		const originalStart: number = req.offset ? req.offset : DEFAULT_STORAGE_READ_REQUEST_OFFSET;
		const originalEnd: number = req.limit ? originalStart + req.limit - 1 : originalStart + DEFAULT_STORAGE_READ_REQUEST_LIMIT - 1;
		const start: number = req.order === "desc" ? -originalEnd - 1 : originalStart;
		const end: number = req.order === "desc" ? -originalStart - 1 : originalEnd;

		const result: string[] = await this.storageZrange(this.createStorageKey(req), start, end);
		if (!result) {
			throw new Error("invalid read storage result.");
		}

		const readResponse: GameExternalStorageReadResponse = {
			gameCode,
			playScope: req.playScope ? req.playScope : "global",
			key: req.key,
			type: req.type,
			data: [],
		};

		for (const memberScore of result) {
			const score = memberScore.split(":").pop();
			const playerId = memberScore.split(`:${score}`).shift();
			if (!playerId) {
				throw new Error("invalid read storage result.");
			}
			const readResponseData = {
				playerId,
				value: GameExternalStorageDataAccessBase.convertValueType(score, req.type),
			};
			if (req.order === "desc") {
				readResponse.data.unshift(readResponseData);
			} else {
				readResponse.data.push(readResponseData);
			}
		}

		return readResponse;
	}

	private async doWritePlayers(req: GameExternalStorageWriteRequest): Promise<GameExternalStorageWriteResponse> {
		const gameCode: string = this.getGameCode(req);
		const storageKey: string = this.createStorageKey(req);
		const keys: string[] = [];
		const values: string[] = [];
		let originalValues: string[] = [];

		if (req.writeType === "incr" || req.writeType === "decr") {
			const originalKeys: string[] = [];
			for (const data of req.data) {
				originalKeys.push(`${storageKey}:${data.playerId}`);
			}

			originalValues = await this.storageMget(originalKeys);
		}

		const writeResponse: GameExternalStorageWriteResponse = {
			failed: [],
		};

		for (let index: number = 0; index < req.data.length; index++) {
			const data: StorageData = req.data[index];
			const key: string = `${storageKey}:${data.playerId}`;

			// StorageWriteType別のvalue設定
			let value: StorageValue = data.value !== null || data.value !== undefined ? data.value : null;
			if (req.writeType === "incr" || req.writeType === "decr") {
				const originalValue: number = originalValues[index] ? Number(originalValues[index]) : 0;
				if (req.writeType === "incr") {
					value = originalValue + Number(value);
				} else if (req.writeType === "decr") {
					value = originalValue - Number(value);
				}
			}

			const failureInfo = GameExternalStorageDataAccessBase.getGameExternalStorageWriteFailureInfo(req, value, {
				gameCode,
				playScope: GameExternalStorageDataAccessBase.getPlayScope(req),
				key: req.key,
				type: req.type,
				playerId: data.playerId,
				failureType: null,
				message: "",
			});

			if (failureInfo) {
				writeResponse.failed.push(failureInfo);
				continue;
			}

			keys.push(key);
			if (typeof value === "object") {
				values.push(JSON.stringify(value));
			} else {
				values.push(`${value}`);
			}
		}

		// req.dataが全てvalidationエラーだった場合
		if (values.length === 0) {
			return writeResponse;
		}

		await this.storageMset(keys, values);

		return writeResponse;
	}

	private async doWriteOrder(req: GameExternalStorageWriteRequest): Promise<GameExternalStorageWriteResponse> {
		const gameCode: string = this.getGameCode(req);
		const storageKey: string = this.createStorageKey(req);
		const members: string[] = [];
		const scores: number[] = [];
		const originalMemberScores: { [key: string]: number } = {};

		if (req.writeType === "incr" || req.writeType === "decr") {
			const result: string[] = await this.storageZrange(storageKey, 0, -1);
			for (const memberScore of result) {
				const score = memberScore.split(":").pop();
				originalMemberScores[memberScore.split(`:${score}`).shift()] = Number(score);
			}
		}

		const writeResponse: GameExternalStorageWriteResponse = {
			failed: [],
		};

		for (const data of req.data) {
			// StorageWriteType別のvalue設定
			let value: StorageValue = data.value !== null || data.value !== undefined ? data.value : null;
			if (req.writeType === "incr" || req.writeType === "decr") {
				const originalScore: number = originalMemberScores[data.playerId] ? originalMemberScores[data.playerId] : 0;
				if (req.writeType === "incr") {
					value = originalScore + Number(value);
				} else if (req.writeType === "decr") {
					value = originalScore - Number(value);
				}
			}

			const failureInfo = GameExternalStorageDataAccessBase.getGameExternalStorageWriteFailureInfo(req, value, {
				gameCode,
				playScope: GameExternalStorageDataAccessBase.getPlayScope(req),
				key: req.key,
				type: req.type,
				playerId: data.playerId,
				failureType: null,
				message: "",
			});

			if (failureInfo) {
				writeResponse.failed.push(failureInfo);
				continue;
			}

			members.push(data.playerId);
			scores.push(Number(value));
		}

		// req.dataが全てvalidationエラーだった場合
		if (scores.length === 0) {
			return writeResponse;
		}

		await this.storageZadd(storageKey, members, scores);

		return writeResponse;
	}

	private static convertValueType(value?: string, valueType?: StorageValueType): StorageValue {
		if (value === null || value === undefined) {
			return null;
		} else if (valueType === "string") {
			return value;
		} else if (valueType === "number" || valueType === "ordered-number") {
			return Number(value);
		} else if (valueType === "general") {
			try {
				return JSON.parse(value);
			} catch (error: any) {
				return null;
			}
		} else {
			return null;
		}
	}

	private static checkReadRequestParameter(req: GameExternalStorageReadRequest): boolean {
		// 必須項目チェック
		if (!req.key || (!req.playerIds && !req.order && !req.rankOfPlayerId)) {
			return false;
		}

		// 選択項目チェック
		if (GameExternalStorageDataAccessBase.checkSelectedReadRequestParameter(req)) {
			return false;
		}

		// typeチェック
		if ((req.type === "ordered-number" && req.playerIds) || (req.type !== "ordered-number" && (req.order || req.rankOfPlayerId))) {
			return false;
		}

		// limit、offsetチェック
		if ((req.limit && req.limit < 0) || (req.offset && req.offset < 0)) {
			return false;
		}

		// rankOfPlayerIdチェック
		if (req.rankOfPlayerId && (req.limit || req.offset)) {
			return false;
		}

		return true;
	}

	private static checkSelectedReadRequestParameter(req: GameExternalStorageReadRequest) {
		return (
			(req.playerIds && req.order && req.rankOfPlayerId) ||
			(req.playerIds && req.order) ||
			(req.playerIds && req.rankOfPlayerId) ||
			(req.order && req.rankOfPlayerId)
		);
	}

	private static checkWriteRequestParameter(req: GameExternalStorageWriteRequest): boolean {
		// 必須項目チェック
		if (!req.key || !req.data) {
			return false;
		}

		return true;
	}

	private static getGameExternalStorageWriteFailureInfo(
		req: GameExternalStorageWriteRequest,
		value: StorageValue,
		info: GameExternalStorageWriteFailureInfo,
	): GameExternalStorageWriteFailureInfo {
		if (typeof value === "string") {
			if (req.type !== "string") {
				info.failureType = "notPermitted";
				info.message = `valueの型がリクエストの型と異なります（value:${value}, type:${req.type}）`;
				return info;
			}
		} else if (typeof value === "number") {
			if (req.type === "string" || req.type === "general") {
				info.failureType = "notPermitted";
				info.message = `valueの型がリクエストの型と異なります（value:${value}, type:${req.type}）`;
				return info;
			} else if (!isFinite(value)) {
				info.failureType = "notPermitted";
				info.message = `valueの値が不正です（value:${value}, type:${req.type}）`;
				return info;
			} else if (value < req.min) {
				info.failureType = "subceedMin";
				info.message = `valueがリクエストのmin値を下回りました（value:${value}, min:${req.min}）`;
				return info;
			} else if (req.max < value) {
				info.failureType = "exceedMax";
				info.message = `valueがリクエストのmax値を上回りました（value:${value}, max:${req.max}）`;
				return info;
			}
		} else if (typeof value === "object") {
			if (req.type !== "general") {
				info.failureType = "notPermitted";
				info.message = `valueの値が不正です（value:${value}, type:${req.type}）`;
				return info;
			}
		}
		return null;
	}
}
