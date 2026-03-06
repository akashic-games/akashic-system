export interface PlayTokenMetaLike {
	/**
	 * プレートークンを発行したユーザーのID
	 */
	userId?: string;
	/**
	 * その他メタデータ
	 */
	[key: string]: any;
}
