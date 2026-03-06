import { MysqlError } from "mysql";

/**
 * mysqlレスポンスのエラーかどうかを判別する。
 * errnoも指定すると、該当エラーかどうかも含めて判別する
 * mysqlの接続エラー等のmysqlプロトコル外のエラーは判別できない
 */
export function isMysqlError(error: any, errno?: number): boolean {
	if (!error || typeof error.code !== "string" || typeof error.errno !== "number" || !error.sqlState) {
		return false;
	}
	if (!errno) {
		return true;
	}
	const err: MysqlError = error;
	return err.errno === errno;
}

/**
 * ユニークキー制約によるエラーかどうかを判別する
 */
export function isDuplicateEntry(error: any): boolean {
	return isMysqlError(error, 1062);
}
/**
 * SQLのパースエラーかどうかを判別する
 */
export function isParseError(error: any): boolean {
	return isMysqlError(error, 1064);
}

/**
 * SQLのパースエラーかどうかを判別する
 */
export function isBadFieldError(error: any): boolean {
	return isMysqlError(error, 1054);
}
