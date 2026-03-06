import VideoSetting = require("../../src/entities/VideoSetting");
import VideoSettingLike = require("../../src/entities/VideoSettingLike");

describe("VideoSetting", () => {
	it("test-constructor", () => {
		const data: VideoSettingLike = {
			instanceId: "111",
			videoPublishUri: "rtmp://example.nico",
			videoFrameRate: 60,
		};
		const videoSetting = new VideoSetting(data);
		expect(videoSetting.instanceId).toEqual(data.instanceId);
		expect(videoSetting.videoPublishUri).toEqual(data.videoPublishUri);
		expect(videoSetting.videoFrameRate).toEqual(data.videoFrameRate);
	});
	it("test-toJson", () => {
		const data: VideoSettingLike = {
			instanceId: "111",
			videoPublishUri: "rtmp://example.nico",
			videoFrameRate: 60,
		};
		const videoSetting = new VideoSetting(data);
		expect(videoSetting.instanceId).toEqual(data.instanceId);
		expect(videoSetting.videoPublishUri).toEqual(data.videoPublishUri);
		expect(videoSetting.videoFrameRate).toEqual(data.videoFrameRate);
	});
	it("test-fromObject", () => {
		let videoSetting: VideoSetting;
		const data: VideoSettingLike = {
			instanceId: "111",
			videoPublishUri: "rtmp://example.nico",
			videoFrameRate: 60,
		};
		videoSetting = VideoSetting.fromObject(data);
		expect(videoSetting.instanceId).toEqual(data.instanceId);
		expect(videoSetting.videoPublishUri).toEqual(data.videoPublishUri);
		expect(videoSetting.videoFrameRate).toEqual(data.videoFrameRate);
		expect(() => VideoSetting.fromObject(null)).toThrow();
	});
});
