export interface IPlaylogMetadataStore {
	/**
	 * プレイがアーカイブ化されて、かつmongoDBStoreから消されているかどうかを取得する
	 */
	shouldGetFromArchive(playId: string): Promise<boolean>;

	/**
	 * プレイがアーカイブ化されて、かつmongoDBStoreから消されているかどうかを設定する
	 */
	setShouldGetFromArchive(playId: string, shouldGetFromArchive: boolean): Promise<void>;

	/**
	 * プレイのアーカイブが作成されているかどうかを取得する
	 */
	getHasArchived(playId: string): Promise<boolean>;

	/**
	 * プレイのアーカイブが作成されているかどうかを設定する
	 */
	setHasArchived(playId: string, hasArchive: boolean): Promise<void>;

	/**
	 * 最終アクセス日時を更新する
	 */
	updateLastAccessTime(playId: string): Promise<void>;
}
