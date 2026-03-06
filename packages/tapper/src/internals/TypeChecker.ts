import "reflect-metadata";
import { FieldPacket, MYSQL_TYPE } from "./packets";
const MYSQL_CHARSET_BINARY = 63;

export function getCastFromFieldAndMetadata(field: FieldPacket, TClass: any): (data: any) => any {
	const type = Reflect.getMetadata("design:type", TClass.prototype, field.name);
	const cast = getCastFromFieldAndType(field, type);
	if (cast === undefined) {
		let typeName = type;
		if (type.name) {
			typeName = type.name;
		}
		throw new TypeError("cannot cast from mysql_type = " + field.type + " to " + typeName + " filed.name = " + field.name);
	}
	return cast;
}

namespace Converters {
	export function nop(data: any): any {
		return data;
	}
	export function toString(data: any): string {
		if (data === null || data === undefined) {
			// null/undefinedはそのまま通す
			return data;
		}
		return String(data);
	}
	export function toDate(data: any): Date {
		if (!(data instanceof Date)) {
			if (data === null || data === undefined) {
				// null/undefinedはそのまま通す
				return data;
			}
			const dateValue = Date.parse(data);
			if (isNaN(dateValue)) {
				throw new TypeError("cannot cast " + data + " to Date");
			}
			return new Date(dateValue);
		}
		return data;
	}
	export function toDateForDATEType(data: any): Date {
		if (!(data instanceof Date)) {
			if (typeof data === "string") {
				data += " 00:00:00"; // mysqlのDATE型をDateに食わせると時差を二重計算してしまうので、回避
			}
			if (data === null || data === undefined) {
				// null/undefinedはそのまま通す
				return data;
			}
			const dateValue = Date.parse(data);
			if (isNaN(dateValue)) {
				throw new TypeError("cannot cast " + data + " to Date");
			}
			return new Date(dateValue);
		}
		return data;
	}
	export function toDateString(data: any): string {
		if (data instanceof Date) {
			return data.toString();
		}
		if (data === null || data === undefined) {
			// null/undefinedはそのまま通す
			return data;
		}
		return String(data);
	}
}

// tslint:disable-next-line:cyclomatic-complexity
function getCastFromFieldAndType(field: FieldPacket, type: any): (data: any) => any {
	if (type === undefined) {
		return Converters.nop; // 型情報なし
	}
	switch (field.type) {
		case MYSQL_TYPE.DECIMAL:
		case MYSQL_TYPE.NEWDECIMAL:
		case MYSQL_TYPE.TINY:
		case MYSQL_TYPE.SHORT:
		case MYSQL_TYPE.LONG:
		case MYSQL_TYPE.FLOAT:
		case MYSQL_TYPE.DOUBLE:
		case MYSQL_TYPE.INT24:
		case MYSQL_TYPE.YEAR: // node-mysqlは数値扱い
			if (type === Number) {
				return Converters.nop; // 数値型はそのまま返す
			} else if (type === String) {
				return Converters.toString; // 文字列型要求なので、文字列にする
			}
			return undefined;
		case MYSQL_TYPE.LONGLONG:
			if (type === String) {
				return Converters.toString; // 64bit整数は文字列型のみサポート
			}
			return undefined;
		case MYSQL_TYPE.TIMESTAMP: // Date系統
		case MYSQL_TYPE.TIMESTAMP2:
		case MYSQL_TYPE.DATETIME:
		case MYSQL_TYPE.DATETIME2:
		case MYSQL_TYPE.NEWDATE:
			if (type === Date) {
				return Converters.toDate;
			} else if (type === String) {
				return Converters.toDateString;
			}
			return undefined;
		case MYSQL_TYPE.DATE: // mysqlの返り値でDateがおかしくなるので
			if (type === Date) {
				return Converters.toDateForDATEType;
			} else if (type === String) {
				return Converters.toDateString;
			}
			return undefined;
		case MYSQL_TYPE.TIME: // stringになる種類の型
		case MYSQL_TYPE.ENUM:
		case MYSQL_TYPE.SET:
			if (type === String) {
				return Converters.toString;
			}
			return undefined;
		case MYSQL_TYPE.VARCHAR: // バイナリorstringになる種類の型
		case MYSQL_TYPE.STRING:
		case MYSQL_TYPE.VAR_STRING:
		case MYSQL_TYPE.TINY_BLOB:
		case MYSQL_TYPE.MEDIUM_BLOB:
		case MYSQL_TYPE.LONG_BLOB:
		case MYSQL_TYPE.BLOB:
			if (type === String && field.charsetNr !== MYSQL_CHARSET_BINARY) {
				return Converters.toString;
			} else if (type === Buffer && field.charsetNr === MYSQL_CHARSET_BINARY) {
				return Converters.nop;
			}
			return undefined;
		case MYSQL_TYPE.BIT: // バイナリになる型
			if (type === Buffer) {
				return Converters.nop;
			}
			return undefined;
		case MYSQL_TYPE.GEOMETRY: // 位置情報型(x, y)は諦めて何もしない
			return Converters.nop;
		default:
			return undefined; // unsupported
	}
}
