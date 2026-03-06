export enum ApplicationErrorCode {
	UNKNOWN, // 不明エラー
	CLUSTER_CONFLICT_ERROR, // クラスタの情報と矛盾した。zookeeper上の情報と矛盾した時や割り当てしようとしたらプロセスが消滅した時に呼ばれる
	CONNECTION_ERROR, // 接続エラー
	NOT_MASTER_ERROR, // マスターじゃないエラー
	DATABASE_CONFLICT_ERROR, // データベース上の情報と矛盾した。
	NOT_FOUND, // 対象のインスタンスが存在しない
}
export class ApplicationError implements Error {
	public name: string;
	public message: string;
	public code: ApplicationErrorCode;
	public parent: any;
	constructor(message: string, code: ApplicationErrorCode, parent?: any) {
		// V8向けhack
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, ApplicationError);
		}
		this.message = message;
		this.name = "ApplicationError";
		if (parent) {
			if (parent.name) {
				this.name += " - " + parent.name;
			}
			this.message += "\n" + parent;
		}
		this.code = code;
		this.parent = parent;
	}
}
