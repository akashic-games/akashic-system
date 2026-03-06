import * as Cast from "@akashic/cast-util";
import * as dt from "@akashic/server-engine-data-types";
import { Annotations } from "@akashic/tapper";

export interface VideoSettingPatch {
	instanceId?: string;
	videoPublishUri?: string;
	videoFrameRate?: number;
}

export class VideoSetting {
	/**
	 * パッチ情報からの情報の取得と型チェック
	 */
	public static fromPatch(entity: VideoSettingPatch): VideoSetting {
		const result = new VideoSetting();
		result.instanceId = Cast.bigint(entity.instanceId);
		result.videoPublishUri = Cast.string(entity.videoPublishUri, 512);
		result.videoFrameRate = Cast.number(entity.videoFrameRate);
		return result;
	}
	@Annotations.map()
	public instanceId: string;

	@Annotations.map()
	public videoPublishUri: string;

	@Annotations.map()
	public videoFrameRate: number;

	public toEntity(): dt.VideoSetting {
		return new dt.VideoSetting(this);
	}
}
