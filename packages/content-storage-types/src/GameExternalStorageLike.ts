import { StorageData, StoragePlayScope, StorageReadOrder, StorageValueType, StorageWriteFailureType, StorageWriteType } from "./types";

/**
 * GameExternalStorageReadRequest.limitのデフォルト値
 */
export const DEFAULT_STORAGE_READ_REQUEST_LIMIT: number = 10;

/**
 * GameExternalStorageReadRequest.offsetのデフォルト値
 */
export const DEFAULT_STORAGE_READ_REQUEST_OFFSET: number = 0;

/**
 * ストレージの領域を識別する情報。
 *
 * この値ごとにデータを保存する領域が定まる。
 */
export interface GameExternalStorageLocator {
	/**
	 * 保存先の gameCode　。
	 * 省略された場合、このゲームのゲームコード。
	 */
	gameCode?: string;

	/**
	 * 保存先のプレイスコープ。
	 * 省略された場合、 "global" 。
	 */
	playScope?: StoragePlayScope;

	/**
	 * 保存先を識別する文字列。
	 *
	 * (TODO 制限明記。文字数、文字種制限など。あるなら)
	 */
	key: string;

	/**
	 * 値の型。
	 *
	 * 型まで含めて一つの領域が定まる、すなわち型が違えば別の領域として扱われることに注意。
	 *
	 * type が `"ordered-number"` 以外の場合、この値と playerId で一つのデータ (write() された value) にアクセスできる。
	 * type が `"ordered-number"` の場合、この値が定まると範囲指定された複数のデータ (write() された value) にアクセスできる。
	 */
	type: StorageValueType;
}

export interface GameExternalStorageReadRequest extends GameExternalStorageLocator {
	/**
	 * 誰の値を読み込むか。
	 * playerIdsが指定された場合、type が "ordered-number" である場合、エラー。
	 * order と両方指定された場合、エラー。
	 * order と両方指定されなかった場合、エラー。
	 */
	playerIds?: string[];

	/**
	 * 読み込み順。結果はこの順でソートされ、 limit 個分取得される。
	 * playerIds と両方指定された場合、エラー。order が指定され type が "ordered-number" でない場合、エラー。
	 * playerIds と両方指定されなかった場合、エラー。
	 */
	order?: StorageReadOrder;

	/**
	 * 読み込む個数。
	 * 指定された場合、order が指定されていなければエラー。 0 未満の場合、エラー。
	 * 省略された場合、order が指定されている場合のみ、DEFAULT_STORAGE_READ_REQUEST_LIMIT 。
	 */
	limit?: number;

	/**
	 * 読み込み開始位置。
	 * 指定された場合、order が指定されていなければエラー。 0 未満の場合、エラー。
	 * 省略された場合、order が指定されている場合のみ、DEFAULT_STORAGE_READ_REQUEST_OFFSET 。
	 */
	offset?: number;

	/**
	 * 誰のランクを読み込むか。
	 * rankOfPlayerId が指定された場合、type が "ordered-number" でない場合、エラー。
	 * rankOfPlayerId が指定された場合、playerIds, order, limit, offset が指定された場合、エラー。
	 */
	rankOfPlayerId?: string;
}

export interface GameExternalStorageWriteRequest extends GameExternalStorageLocator {
	/** プレイヤー別の書き込むデータ。 */
	data: StorageData[];

	/** 書き込みタイプ。詳細は型定義を参照。 */
	writeType?: StorageWriteType;

	/**
	 * 最小値。
	 *
	 * 書き込まれる結果がこの値より小さくなる場合、書き込みに失敗する。
	 * (エラーではないことに注意。コールバックの引数 response の failed[i].failureType が "subceedMin" になる)
	 * type が "number" でない時、無視される。
	 * 省略された場合、 STORAGE_MIN_NUMBER 。
	 */
	min?: number;

	/**
	 * 最大値。
	 *
	 * 書き込まれる結果がこの値より大きくなる場合、書き込みに失敗する。
	 * (エラーではないことに注意。コールバックの引数 response の failed[i].failureType が "exceedMax" になる)
	 * type が "number" でない時、無視される。
	 * 省略された場合、 STORAGE_MAX_NUMBER 。
	 */
	max?: number;
}

export interface GameExternalStorageReadResponse extends GameExternalStorageLocator {
	/**
	 * 読み込み結果。
	 *
	 * `playerIds` による `read()` の結果である時、順序は `playerIds` に対応する。
	 * (すなわち `playerIds[i]` は `data[i].playerId` と一致する)
	 *
	 * `order` による `read()` の結果である時、順序は `order` で指定された順である。
	 */
	data: StorageData[];
}

/**
 * 書き込み失敗情報。
 * 誰のどの領域への書き込みがなぜ失敗したか。
 * ゲームコンテンツがこれを参照してリトライできる必要がある。
 */
export interface GameExternalStorageWriteFailureInfo extends GameExternalStorageLocator {
	playerId: string;
	failureType: StorageWriteFailureType;

	/** 自然言語による失敗の説明。デバッグ用であるため空文字が入る可能性もある */
	message: string;
}

export interface GameExternalStorageWriteResponse {
	/**
	 * 書き込み失敗情報の配列。
	 * 全ての書き込みに成功した場合は空配列になる。
	 */
	failed: GameExternalStorageWriteFailureInfo[];
}

export interface GameExternalStorageTransactionRequest {
	/**
	 * 保存先の gameCode　。
	 * 省略された場合、このゲームのゲームコード。
	 */
	gameCode?: string;
}

export interface StorageTransactionError extends Error {
	/**
	 * トランザクション失敗の種別。
	 * それぞれ 楽観ロックkey変更検知エラー、予期せぬエラー。
	 */
	name: "LockedKeyModifiedError" | "UnexpectedError";
}

export interface GameExternalStorageTransactionLockKey extends GameExternalStorageLocator {
	/**
	 * 楽観ロックを掛けたいkeyに用いられる playerId
	 *
	 * type が "ordered-number" 以外の場合、省略不可。
	 * type が "ordered-number" の場合、要省略。
	 *
	 * その他の詳細については、以下を参照のこと。
	 *
	 * @see StorageData.playerId
	 */
	playerId?: string;
}

export interface GameExternalStorageTransactionLockRequest {
	/**
	 * 楽観ロックを掛けたいkeyの配列。
	 */
	lockKeys: GameExternalStorageTransactionLockKey[];
}

interface GameExternalStorageDataAccessLike {
	/**
	 * 永続化領域から読み込む。
	 *
	 * 異常系の種類は以下の通り。
	 *     - 処理実行時エラー(リカバリ不可能): callback の error オブジェクトが非 null の場合。
	 *
	 * req.playerIds[i] に対応する値がない場合、response.data[i].value は null である。
	 * req.offset が大きすぎる場合、 response.data は [] である。
	 */
	read(
		req: GameExternalStorageReadRequest,
		callback: (error: Error | null, response: GameExternalStorageReadResponse | null) => void,
	): void;

	/**
	 * 永続化領域に書き込む。
	 *
	 * 異常系の種類は以下の通り。
	 *     - 処理実行時エラー(リカバリ不可能): callback の error オブジェクトが非 null の場合。
	 *     - 処理失敗(リカバリ可): 上記の異常系以外で、 response.failed が空配列ではない場合。
	 *
	 * 処理失敗時のリカバリ方法。
	 *     - response.failed[i].failureType の種別ごとに req.data[i] を修正した後、再実行。
	 */
	write(
		req: GameExternalStorageWriteRequest,
		callback: (error: Error | null, response: GameExternalStorageWriteResponse | null) => void,
	): void;
}

export interface GameExternalStorageLike extends GameExternalStorageDataAccessLike {
	/**
	 * 永続化領域にアトミックに書き込むためのトランザクションオブジェクトを取得する。
	 *
	 * 異常系の種類は以下の通り。
	 *     - 処理実行時エラー(リカバリ不可能): callback の error オブジェクトが非 null の場合。
	 *
	 * なお、トランザクションオブジェクトを取得してトランザクションを開始した後は、
	 * 最終的に必ず commit または rollback を呼び出してトランザクションを終了させる必要がある。
	 */
	beginTransaction(
		req: GameExternalStorageTransactionRequest,
		callback: (error: Error | null, tx: GameExternalStorageTransactionProcessLike) => void,
	): void;
}

export interface GameExternalStorageTransactionProcessLike extends GameExternalStorageDataAccessLike {
	/**
	 * 楽観ロック処理。
	 *
	 * 異常系の種類は以下の通り。
	 *     - 処理実行時エラー(リカバリ不可能): callback の error オブジェクトが非 null の場合。
	 */
	lock(req: GameExternalStorageTransactionLockRequest, callback: (error: Error | null) => void): void;

	/**
	 * トランザクションのコミット処理。
	 *
	 * 異常系の種類は以下の通り。
	 *     - 処理実行時エラー(リカバリ不可能): error.name === "UnexpectedError" の場合。
	 *     - 処理失敗(リカバリ可): 上記の異常系以外で、 error.name === "LockedKeyModifiedError" の場合。
	 *
	 * 処理失敗時のリカバリ方法。
	 *     - 再度楽観ロック処理を実行した後、コミット処理を実行。
	 */
	commit(callback: (error: StorageTransactionError | null) => void): void;

	/**
	 * トランザクションのロールバック処理。
	 *
	 * 異常系の種類は以下の通り。
	 *     - 処理実行時エラー(リカバリ不可能): callback の error オブジェクトが非 null の場合。
	 */
	rollback(callback: (error: Error | null) => void): void;
}
