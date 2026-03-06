import {
	StoragePlayScope,
	StorageValueType,
	StorageValue,
	StorageReadOrder,
	StorageWriteType,
	StorageData,
	StorageWriteCondition,
	StorageWriteFailureType,
} from "./types";

/**
 * ストレージの領域を識別する情報。
 *
 * この値ごとに書き込む値の性質・条件を declare() できる (数値なのか文字列なのか、上限や下限などを)
 *
 * type が `"ordered-number"` 以外の場合、この値と playerId で一つのデータ (write() された value) にアクセスできる。
 * type が `"ordered-number"` の場合、この値が定まると範囲指定された複数のデータ (write() された value) にアクセスできる。
 */
export interface AkashicStorageLibLocator {
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
	 */
	key: string;
}

export interface AkashicStorageLibDeclaration extends AkashicStorageLibLocator {
	/**
	 * 値の型。
	 */
	type: StorageValueType;

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

	/** デフォルト値。type に合致しない場合、エラー。指定しない場合、 `null` 。 */
	defaultValue?: StorageValue;
}

export interface AkashicStorageLibReadRequest extends AkashicStorageLibLocator {
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
	 * 省略された場合、order が指定されている場合のみ、DEFAULT_STORAGE_READ_REQUEST_LIMIT の値。
	 */
	limit?: number;

	/**
	 * 読み込み開始位置。
	 * 指定された場合、order が指定されていなければエラー。 0 未満の場合、エラー。
	 * 省略された場合、order が指定されている場合のみ、DEFAULT_STORAGE_READ_REQUEST_OFFSET の値。
	 */
	offset?: number;
}

export interface AkashicStorageLibWriteRequest extends AkashicStorageLibLocator {
	/** プレイヤー別の書き込むデータ。 */
	data: StorageData[];
	/** 書き込みタイプ。詳細は型定義を参照。 */
	writeType?: StorageWriteType;
	/** 書き込み条件。詳細は型定義を参照。 */
	condition?: StorageWriteCondition;
}

export interface AkashicStorageLibReadResponse extends AkashicStorageLibLocator {
	data: StorageData[];
}

/**
 * 書き込み失敗情報。
 * 誰のどの領域への書き込みがなぜ失敗したか。
 * ゲームコンテンツがこれを参照してリトライできる必要がある。
 */
export interface AkashicStorageLibWriteFailureInfo extends AkashicStorageLibLocator {
	playerId: string;
	failureType: StorageWriteFailureType;

	/** 自然言語による失敗の説明。デバッグ用であるため空文字が入る可能性もある */
	message: string;
}

export interface AkashicStorageLibWriteResponse {
	failed: AkashicStorageLibWriteFailureInfo[];
}

export interface AkashicStorageLibLike {
	apiVersion: number; // 現時点では常に 1 。

	declare(decls: AkashicStorageLibDeclaration[], callback: (error: Error | null) => void): void;
	read(req: AkashicStorageLibReadRequest, callback: (error: Error | null, response: AkashicStorageLibReadResponse | null) => void): void;
	read(
		reqs: AkashicStorageLibReadRequest[],
		callback: (error: Error | null, response: AkashicStorageLibReadResponse[] | null) => void,
	): void;
	write(req: AkashicStorageLibWriteRequest, callback: (error: Error | null, response: AkashicStorageLibWriteResponse | null) => void): void;
	write(
		reqs: AkashicStorageLibWriteRequest[],
		callback: (error: Error | null, response: AkashicStorageLibWriteResponse[] | null) => void,
	): void;
}
