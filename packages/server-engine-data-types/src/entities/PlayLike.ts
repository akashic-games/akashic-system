interface PlayLike {
	/**
	 * プレイID
	 */
	id?: string;
	/**
	 * ゲーム
	 */
	gameCode: string;
	/**
	 * プレーの派生元ID
	 */
	parentId?: string;
	/**
	 * 作成日時
	 */
	started: Date;
	/**
	 * 登録日時
	 */
	finished?: Date;
	/**
	 * プレー状態
	 */
	status: string;
}
export = PlayLike;
