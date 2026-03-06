import Cast = require("@akashic/cast-util");
import VideoSettingLike = require("./VideoSettingLike");

class VideoSetting implements VideoSettingLike {
	/**
	 * 対象のインスタンスID
	 */
	get instanceId(): string {
		return this._instanceId;
	}
	/**
	 * 映像の出力先のエンドポイント
	 */
	get videoPublishUri(): string {
		return this._videoPublishUri;
	}
	/**
	 * 映像のフレームレート
	 */
	get videoFrameRate(): number {
		return this._videoFrameRate;
	}
	public static fromObject(obj: any): VideoSetting {
		if (!obj) {
			throw new TypeError("obj is not valid");
		}
		return new VideoSetting({
			instanceId: Cast.bigint(obj.instanceId, false, "property instanceId is not valid"),
			videoPublishUri: Cast.string(obj.videoPublishUri, 512, false, "property videoPublishUri is not valid"),
			videoFrameRate: Cast.int(obj.videoFrameRate, false, "property videoFrameRate is not valid"),
		});
	}
	private _instanceId: string;
	private _videoPublishUri: string;
	private _videoFrameRate: number;
	constructor(args: VideoSettingLike) {
		this._instanceId = args.instanceId;
		this._videoPublishUri = args.videoPublishUri;
		this._videoFrameRate = args.videoFrameRate;
	}
	public toJSON(): VideoSettingLike {
		return {
			instanceId: this._instanceId,
			videoPublishUri: this._videoPublishUri,
			videoFrameRate: this._videoFrameRate,
		};
	}
}
export = VideoSetting;
