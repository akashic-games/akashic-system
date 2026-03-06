import constants = require("../constants");
import ProcessStatusInfoLike = require("./ProcessStatusInfoLike");

/**
 * masterへのプロセス状態変化報告用情報
 */
class ProcessStatusInfo implements ProcessStatusInfoLike {
	private _instanceId: string;
	private _type: constants.ProcessStatusType;
	private _message: string;
	constructor(args: ProcessStatusInfoLike) {
		this._instanceId = args.instanceId;
		this._type = args.type;
		this._message = args.message;
	}
	get instanceId(): string {
		return this._instanceId;
	}
	/**
	 * 発生した状態変化
	 */
	get type(): constants.ProcessStatusType {
		return this._type;
	}
	/**
	 * メッセージ
	 */
	get message(): string {
		return this._message;
	}

	public toJSON(): ProcessStatusInfoLike {
		return {
			instanceId: this._instanceId,
			type: this._type,
			message: this._message,
		};
	}
}
export = ProcessStatusInfo;
