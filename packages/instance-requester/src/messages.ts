/**
 * インスタンスへのリクエストメッセージ種別
 */
export const enum InstanceRequestMessageType {
	/**
	 * インスタンス起動要求
	 */
	Start = "start",
	/**
	 * インスタンス停止要求
	 */
	Stop = "stop",
	/**
	 * インスタンス一時停止要求
	 */
	Pause = "pause",
	/**
	 * インスタンス一時停止解除要求
	 */
	Resume = "resume",
}

export interface InstanceRequestMessage<T> {
	instanceId: string;
	type: InstanceRequestMessageType;
	parameters?: T;
}

/**
 * インスタンス起動要求メッセージ
 */
export interface StartInstanceRequestParameters {
	/** インスタンス割り当て先制約 */
	assignmentConstraints?: {
		/** 割り当て game-runner trait 名 */
		trait: string[];
	};
	/** インスタンスの割り当て先を強制指定する場合に指定する */
	forceAssignTo?: {
		/** 割り当て先ホスト名 */
		host: string;
		/** 割り当て先プロセス名 */
		name: string;
	};
}
export interface StartInstanceRequestMessage extends InstanceRequestMessage<StartInstanceRequestParameters> {
	type: InstanceRequestMessageType.Start;
}

/**
 * インスタンス停止要求メッセージ
 */
export interface StopInstanceRequestParameters {
	// パラメータ無し
}
export interface StopInstanceRequestMessage extends InstanceRequestMessage<StopInstanceRequestParameters> {
	type: InstanceRequestMessageType.Stop;
}

/**
 * インスタンス一時停止要求メッセージ
 */
export interface PauseInstanceRequestParameters {
	// パラメータ無し
}
export interface PauseInstanceRequestMessage extends InstanceRequestMessage<PauseInstanceRequestParameters> {
	type: InstanceRequestMessageType.Pause;
}

/**
 * インスタンス一時停止解除要求メッセージ
 */
export interface ResumeInstanceRequestParameters {
	// パラメータ無し
}
export interface ResumeInstanceRequestMessage extends InstanceRequestMessage<ResumeInstanceRequestParameters> {
	type: InstanceRequestMessageType.Resume;
}
