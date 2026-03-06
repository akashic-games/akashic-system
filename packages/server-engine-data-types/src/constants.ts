/**
 * クラスタで使用する定数
 */
/**
 * プロセスの種別を表す定数
 */
/**
 * プロセス種別gameRunnerを表す定数
 */
export const TYPE_GAME_RUNNER_2 = "gameRunner2";
/**
 * イベントハンドラモデルのtypeのうち、インスタンス状態変更イベントを表す定数
 */
export const EVENT_HANDLER_TYPE_INSTANCE_STATUS = "instanceStatus";
/**
 * イベントハンドラモデルのtypeのうち、エラーイベントを表す定数
 */
export const EVENT_HANDLER_TYPE_ERROR = "error";
/**
 * イベントハンドラモデルのtypeのうち、ゲームイベントを表す定数
 */
export const EVENT_HANDLER_TYPE_GAME_EVENT = "gameEvent";
/**
 * instanceの状態(prepare)
 */
export const INSTANCE_STATE_PREPARE = "prepare";
/**
 * instanceの状態(running)
 */
export const INSTANCE_STATE_RUNNING = "running";
/**
 * instanceの状態(pausing)
 * running から paused に遷移中の状態を表す
 */
export const INSTANCE_STATE_PAUSING = "pausing";
/**
 * instanceの状態(paused)
 * instance の実行が一時停止している状態であることを表す
 */
export const INSTANCE_STATE_PAUSED = "paused";
/**
 * instanceの状態(resuming)
 * paused から running に遷移中の状態を表す
 */
export const INSTANCE_STATE_RESUMING = "resuming";
/**
 * instanceの状態(closing)
 */
export const INSTANCE_STATE_CLOSING = "closing";
/**
 * instanceの状態(closed)
 */
export const INSTANCE_STATE_CLOSED = "closed";
/**
 * instanceの状態(error)
 */
export const INSTANCE_STATE_ERROR = "error";
/**
 * instanceのactiveループ動作モード
 */
export const INSTANCE_EXEC_MODE_ACTIVE = "active";
/**
 * instanceのpassiveループ動作モード
 */
export const INSTANCE_EXEC_MODE_PASSIVE = "passive";
/**
 * instanceの稼働先(node.js製server engine)
 */
export const INSTANCE_REGION_NODE = "nodeServerEngine";
/**
 * playの状態(preparing)
 */
export const PLAY_STATE_PREPARING = "preparing";
/**
 * playの状態(running)
 */
export const PLAY_STATE_RUNNING = "running";
/**
 * playの状態(suspending)
 */
export const PLAY_STATE_SUSPENDING = "suspending";
/**
 * playの状態(broken)
 */
export const PLAY_STATE_BROKEN = "broken";

// instance終了コード。終了コードはC++及びlinuxのエラーコードを参考(/usr/include/asm-generic/errno-base.h)
/**
 * インスタンス終了コード(OK)
 */
export const INSTANCE_EXIT_CODE_OK = 0;
/**
 * インスタンス終了コード(プログラム異常終了)
 */
export const INSTANCE_EXIT_CODE_FAILURE = 1;
/**
 * インスタンス終了コード(終了処理に失敗)
 */
export const INSTANCE_EXIT_CODE_SHUTDOWN_FAIL = 2;
/**
 * インスタンス終了コード(サーバ側リソースに空きが無い)
 */
export const INSTANCE_EXIT_CODE_SERVER_RESOURCE_FULL = 3;
/**
 * インスタンス終了コード(ビデオ出力で問題発生)
 */
export const INSTANCE_EXIT_CODE_VIDEO_PUBLISH_ERROR = 4;

/**
 * PlayTokenのPermission flagのindex値
 */
export enum PERMISSION_FLAG_INDEX {
	/**
	 * PlayTokenのpermission flagのreadフラグのindex
	 */
	READ = 0,
	/**
	 * PlayTokenのpermission flagのwriteフラグのindex。値はENABLE_WRITE_PLAYLOGまたはENABLE_WRITE_EVENTを使用すること
	 */
	WRITE = 1,
	/**
	 * PlayTokenのpermission flagのeventSubscribeフラグのindex
	 */
	EVENT_SUBSCRIBE = 2,
}
/**
 * PlayTokenのPermission flagのreadで使用する値
 */
export enum PERMISSION_READ_FLAG_VALUES {
	/**
	 * PlayTokenのreadフラグで、権限が無いことを示す値
	 */
	DISABLED = 0,
	/**
	 * PlayTokenのreadフラグで、権限があることを示す値
	 */
	ENABLED = 1,
}
/**
 * PlayTokenのPermission flagのWRITEで使用する値
 */
export enum PERMISSION_WRITE_FLAG_VALUES {
	/**
	 * PlayTokenのwriteフラグで、権限が無いことを示す値
	 */
	DISABLED = 0,
	/**
	 * PlayTokenのwriteフラグで、ActiveAEとして書き込み権限があることを示す値
	 */
	ENABLE_PLAYLOG = 1,
	/**
	 * PlayTokenのwriteフラグで、(メインの)プレイヤーの操作要求とかのEventを書き込む権限があることを示す値
	 */
	ENABLE_MAIN_PLAYER_EVENT = 2,
	/**
	 * PlayTokenのwriteフラグで、参加視聴者(サブプレイヤー)の操作要求とかのEventを書き込む権限があることを示す値
	 */
	ENABLE_SUB_PLAYER_EVENT = 4,
}
/**
 * PlayTokenのPermission flagで使用する値
 */
export enum PERMISSION_EVENT_READ_FLAG_VALUES {
	/**
	 * PlayTokenのeventフラグで、権限が無いことを示す値
	 */
	DISABLED = 0,
	/**
	 * PlayTokenのeventフラグで、権限があることを示す値
	 */
	ENABLED = 1,
}

/**
 * masterへのプロセス状態変化報告用情報
 */
export enum ProcessStatusType {
	/**
	 * 正常終了
	 * (リプレーの終端時等による自発的終了)
	 */
	INSTANCE_FINISHED = 0,
	/**
	 * インスタンス異常終了
	 */
	INSTANCE_CRASHED = 1,
	/**
	 * 動画出力停止
	 */
	VIDEO_STOPPED = 2,
	/**
	 * 無限ループ検知で強制終了
	 */
	INFINITY_LOOP_DETECTED = 3,
}
