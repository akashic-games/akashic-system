/**
 * node-mysqlのqueryの第三引数に来るかもしれない情報。
 * 内容はCOM_QUERY_RESPONSEパケットのFIELDの値に対応した物
 * 仕様情報
 * https://dev.mysql.com/doc/internals/en/com-query-response.html
 * http://slide.rabbit-shocker.org/authors/tommy/mysql-protocol/
 */
export interface FieldPacket {
	/**
	 * 常にdef。protocol41=trueで出現
	 */
	catalog?: string;
	/**
	 * データベース名。protocol41=trueで出現
	 */
	db?: string;
	/**
	 * テーブル名
	 */
	table: string;
	/**
	 * オリジナルテーブル名。protocol41=trueで出現
	 */
	orgTable?: string;
	/**
	 * カラム名
	 */
	name: string;
	/**
	 * オリジナルカラム名。protocol41=trueで出現
	 */
	orgName?: string;
	/**
	 * charset番号。protocol41=trueで出現
	 */
	charsetNr?: number;
	/**
	 * データ長(バイト数)
	 */
	length: number;
	/**
	 * 型
	 */
	type: number;
	/**
	 * フラグ情報。protocol41=trueで出現
	 */
	flags?: number;
	/**
	 * 少数の桁数。protocol41=trueで出現
	 */
	decimals?: number;
	/**
	 * デフォルト値(フィールドリストコマンド時のみ)
	 */
	default?: string;
	/**
	 * プロトコル41フラグ
	 */
	protocol41: boolean;
}

/**
 * mysqlデータ型
 * https://dev.mysql.com/doc/internals/en/com-query-response.html
 */
export enum MYSQL_TYPE {
	DECIMAL = 0,
	TINY = 1,
	SHORT = 2,
	LONG = 3,
	FLOAT = 4,
	DOUBLE = 5,
	NULL = 6,
	TIMESTAMP = 7,
	LONGLONG = 8,
	INT24 = 9,
	DATE = 10,
	TIME = 11,
	DATETIME = 12,
	YEAR = 13,
	NEWDATE = 14,
	VARCHAR = 15,
	BIT = 16,
	TIMESTAMP2 = 17,
	DATETIME2 = 18,
	TIME2 = 19,
	NEWDECIMAL = 246,
	ENUM = 247,
	SET = 248,
	TINY_BLOB = 249,
	MEDIUM_BLOB = 250,
	LONG_BLOB = 251,
	BLOB = 252,
	VAR_STRING = 253,
	STRING = 254,
	GEOMETRY = 255,
}
