/**
 * エラーコード 404 のときに返すエラー
 */
export class AmqpNotFoundError extends Error {
	public cause: any;

	constructor(msg: string, cause?: any) {
		super(msg);
		this.cause = cause;
	}
}
