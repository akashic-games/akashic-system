/**
 * 動画出力に使用する情報
 */
interface VideoSettingLike {
	/**
	 * 対象のインスタンスID
	 */
	instanceId: string;
	/**
	 * 映像の出力先のエンドポイント
	 */
	videoPublishUri: string;
	/**
	 * 映像のフレームレート
	 */
	videoFrameRate: number;
}
export = VideoSettingLike;
