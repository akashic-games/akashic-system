import dt = require("@akashic/server-engine-data-types");

export interface PagingRequest {
	/**
	 * 結果一覧のoffset
	 */
	_offset?: number;
	/**
	 * 結果一覧の返却件数
	 */
	_limit?: number;
	/**
	 * 結果に総件数を付与するかのフラグ
	 */
	_count?: number;
}

export interface GetItemRequest {
	/**
	 * 取得する対象のID
	 */
	id: string;
}

export interface CreateInstanceRequest {
	/**
	 * 作成するインスタンスで動かすゲームの識別子
	 */
	gameCode: string;
	/**
	 * 実行する js ファイルのパス
	 */
	entryPoint: string;
	/**
	 * 作成するインスタンスで動かすゲームの実行コスト
	 */
	cost: number;
	/**
	 * 作成するインスタンスに入れる各種モジュール
	 */
	modules: dt.InstanceModuleLike[];
}

export interface PatchInstanceRequest {
	/**
	 * 指定したstatusに更新する
	 */
	status: string;
	/**
	 * 指定したexitCodeに更新する
	 */
	exitCode?: string;
}

export interface FindInstancesRequest extends PagingRequest {
	/**
	 * 検索対象ゲームコード
	 */
	gameCode?: string;
	/**
	 * 検索対象のインスタンス状態
	 */
	status?: string[];
	/**
	 * 検索対象の実行ファイルパス名
	 */
	entryPoint?: string;
	/**
	 * 検索対象のビデオ出力先
	 */
	videoPublishUri?: string;
	/**
	 * 検索対象の実行プロセス識別子
	 */
	processName?: string;
}

export interface ValidateTokenRequest {
	/**
	 * 検証対象のplayId
	 */
	playId: string;
	/**
	 * 検証対象のトークン文字列
	 */
	value: string;
}

export interface GetPlaysRequest extends PagingRequest {
	/**
	 * 取得対象のgameId
	 */
	gameCode?: string;
	/**
	 * 取得対象のstatus一覧
	 */
	status?: string[];
	/**
	 * 取得する際の並び順
	 */
	order?: string;
}

export interface CreatePlayRequest {
	/**
	 * ゲームコード
	 * 新規プレー作成か、プレーデータ指定の派生プレー作成時に必須
	 */
	gameCode?: string;
	/**
	 * 派生プレー作成時の親プレー情報
	 */
	parent?: {
		/**
		 * プレー ID 指定
		 */
		playId?: string;
		/**
		 * プレーログデータ直接指定
		 */
		playData?: string;
		/**
		 * コピーするプレーログの最終フレーム番号 (指定のない場合は全てのプレーログをコピー)
		 */
		frame?: number;
	};
}

export interface PatchPlayRequest {
	/**
	 * 指定したstatusに更新する
	 */
	status: string;
}

export interface CreatePlaylogEventRequest {
	/**
	 * イベントの種別
	 */
	type: string;
	/**
	 * イベント種別に応じた値
	 */
	values: any;
}

export interface CopyPlaylogRequest {
	/**
	 * 既存 play からコピーする場合のコピー元 playId
	 */
	playId?: string;
	/**
	 * データを直接指定する場合のデータ
	 */
	playData?: string;
	/**
	 * コピーするフレーム数 (指定のない場合は全てコピー)
	 */
	count?: number;
}

export interface GetReportsRequest extends PagingRequest {
	/**
	 * ソート指定
	 */
	_sort?: string;
	/**
	 * 条件フィルタ
	 */
	condition?: string;
	/**
	 * 日時フィルタ（自）
	 */
	since?: Date;
	/**
	 * 日時フィルタ（至）
	 */
	until?: Date;
}
/**
 * zip登録時に返却される情報
 */
export interface RegisteredGameInfo {
	/**
	 * このゲームの幅
	 */
	width: number;
	/**
	 * このゲームの高さ
	 */
	height: number;
	/**
	 * このゲームのFPS
	 */
	fps: number;
}
