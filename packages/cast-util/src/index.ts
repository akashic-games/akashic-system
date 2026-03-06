import BigNumber from "bignumber.js";
import validator from "validator";
/**
 * 最大FQDN長は255文字
 * http://jbpe.tripod.com/rfcj/rfc1123.j.sjis.txt
 */
const maxFQDNLength = 255;
/**
 * javascriptで扱える範囲の整数型にバリデーション&キャストする
 * 扱える範囲はjsが正しく扱える数値の範囲である-9007199254740992〜9007199254740992の範囲
 * 整数値として解釈不能なものか範囲外の物は例外を投げる
 * http://stackoverflow.com/questions/307179/what-is-javascripts-highest-integer-value-that-a-number-can-go-to-without-losin
 */
export function int(value: any, optional = false, message?: string): number {
	if (optional && isValidOptional(value)) {
		return value;
	}
	if (typeof value === "number") {
		value = String(value);
	}
	if (typeof value === "string") {
		if (validator.isInt(value)) {
			const bigNum = new BigNumber(value);
			if (bigNum.isLessThan("-9007199254740992") || bigNum.isGreaterThan("9007199254740992")) {
				throw new RangeError(message === undefined ? "int range error" : message);
			}
			return Number(value);
		}
	}
	throw new TypeError(message === undefined ? "int cast error" : message);
}
/**
 * 数値文字列にバリデーション&キャストする
 */
export function bigint(value: any, optional = false, message?: string): string {
	if (optional && isValidOptional(value)) {
		return value;
	}
	if (typeof value === "number") {
		value = String(value);
	}
	if (typeof value === "string") {
		if (validator.isInt(value)) {
			return value;
		}
	}
	throw new TypeError(message === undefined ? "bigint cast error" : message);
}
/**
 * 浮動小数点にバリデーション&キャストする
 */
export function number(value: any, optional = false, message?: string): number {
	if (optional && isValidOptional(value)) {
		return value;
	}
	if (typeof value === "number") {
		value = String(value);
	}
	if (typeof value === "string") {
		if (validator.isFloat(value)) {
			return Number(value);
		}
	}
	throw new TypeError(message === undefined ? "number cast error" : message);
}
/**
 * 指定した範囲内の整数値にバリデーションキャストする
 */
export function rangeInt(value: any, min: number, max: number, optional = false, message?: string): number {
	if (optional && isValidOptional(value)) {
		return value;
	}
	const v = int(value, optional, message);
	if (v >= min && v <= max) {
		return v;
	}
	throw new RangeError(message === undefined ? "int range error" : message);
}
/**
 * 文字列にバリデーション&キャストする
 */
export function string(value: any, maxLength?: number, optional = false, message?: string): string {
	if (optional && isValidOptional(value)) {
		return value;
	}
	if (typeof value === "string") {
		if (maxLength === undefined || value.length <= maxLength) {
			return value;
		}
	}
	throw new TypeError(message === undefined ? "string cast error" : message);
}
/**
 * 指定した文字列の範囲にバリデーション&キャストする
 */
export function rangeString(value: any, valids: string[], optional = false, message?: string): string {
	if (optional && isValidOptional(value)) {
		return value;
	}
	const v = string(value, undefined, optional, message);
	if (valids.indexOf(v) !== -1) {
		return v;
	}
	throw new RangeError(message === undefined ? "string range error" : message);
}
/**
 * 指定した文字がFQDNまたはhost名かをチェックしてキャストする
 */
export function fqdnOrHostname(value: any, optional = false, message?: string): string {
	if (optional && isValidOptional(value)) {
		return value;
	}
	const v = string(value, maxFQDNLength, optional, message);
	if (validator.isFQDN(v) || /^[0-9a-zA-Z\-_~]+$/.test(v)) {
		// isFQDNは.の無いただのホスト名をエラーにするため。
		return v;
	}
	throw new RangeError(message === undefined ? "string fqdn range error" : message);
}
/**
 * 指定した文字がURIに使われない文字かをチェックしてキャストする
 */
export function uriUnreserved(value: any, maxLength?: number, optional = false, message?: string): string {
	if (optional && isValidOptional(value)) {
		return value;
	}
	const v = string(value, maxLength, optional, message);
	if (/^[0-9a-zA-Z\-\._~]+$/.test(v)) {
		return v;
	}
	throw new RangeError(message === undefined ? "string uri unreserved range error" : message);
}
/**
 * 指定した文字がasciiの範囲かをチェックしてキャストする
 */
export function ascii(value: any, maxLength?: number, optional = false, message?: string): string {
	if (optional && isValidOptional(value)) {
		return value;
	}
	const v = string(value, maxLength, optional, message);
	if (validator.isAscii(v)) {
		return v;
	}
	throw new RangeError(message === undefined ? "string ascii range error" : message);
}
/**
 * Date型にバリデーション&キャストする
 */
export function date(value: any, optional = false, message?: string): Date {
	if (optional && isValidOptional(value)) {
		return value;
	}
	if (typeof value === "string") {
		const time = Date.parse(value);
		if (!isNaN(time)) {
			return new Date(time);
		}
	} else if (value instanceof Date) {
		return value;
	}
	throw new TypeError(message === undefined ? "date cast error" : message);
}
function isValidOptional(value: any): boolean {
	return value === undefined || value === null;
}
