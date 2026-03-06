/**
 * ニコニコシステム間APIの仕様に沿ったエラーを返すためのError
 */
export class ApiError implements Error {
	public name: string;
	/**
	 * エラーメッセージ。meta/errorMessageに出力される
	 */
	public message: string;
	/**
	 * エラーコード。meta/errorCodeに出力される
	 */
	public errorCode: string;
	/**
	 * status: ステータスコード。meta/status及びHTTPステータスコードに出力される
	 */
	public status: number;
	/**
	 * デバッグ情報。meta/debugにutil.inspect化されて出力される
	 */
	public debug: any;
	constructor(message: string, errorCode: string, status: number, debug?: any) {
		// V8向けHack
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, ApiError); // この方式だとここのスタックまでがトレース対象になるが、それを修正するにはV8の改修が必要になるので諦める
		}
		this.message = message;
		this.name = (this.constructor as any).name; // Functionを拡張はできない。
		this.errorCode = errorCode;
		this.status = status;
		this.debug = debug;
	}
}

export class BadRequest extends ApiError {
	constructor(message: string, debug?: any) {
		super(message, "BAD_REQUEST", 400, debug);
	}
}

export class InvalidParameter extends ApiError {
	constructor(message: string, debug?: any) {
		super(message, "INVALID_PARAMETER", 400, debug);
	}
}

export class UnAuthorized extends ApiError {
	constructor(message: string, debug?: any) {
		super(message, "UNAUTHORIZED", 401, debug);
	}
}

export class Forbidden extends ApiError {
	constructor(message: string, debug?: any) {
		super(message, "FORBIDDEN", 403, debug);
	}
}

export class NotFound extends ApiError {
	constructor(message: string, debug?: any) {
		super(message, "NOT_FOUND", 404, debug);
	}
}

export class Conflict extends ApiError {
	constructor(message: string, debug?: any) {
		super(message, "CONFLICT", 409, debug);
	}
}

export class InternalServerError extends ApiError {
	constructor(message: string, debug?: any) {
		super(message, "INTERNAL_SERVER_ERROR", 500, debug);
	}
}

export class NotImplemented extends ApiError {
	constructor(message: string, debug?: any) {
		super(message, "NOT_IMPLEMENTED", 501, debug);
	}
}
export class Busy extends ApiError {
	constructor(message: string, debug?: any) {
		super(message, "BUSY", 503, debug);
	}
}

export class Maintenance extends ApiError {
	constructor(message: string, debug?: any) {
		super(message, "MAINTENANCE", 503, debug);
	}
}
