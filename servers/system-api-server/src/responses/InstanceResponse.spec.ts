import * as dt from "@akashic/server-engine-data-types";
import InstanceResponse from "./InstanceResponse";

class DummyClient {
	public videoSetting: dt.VideoSetting;
	public getVideoSetting() {
		return Promise.resolve({ data: this.videoSetting });
	}
}

describe("InstanceResponse", () => {
	it("fromDomainAndClient", (done: Function) => {
		const instance: dt.Instance = new dt.Instance({
			id: "44445555",
			gameCode: "ncg456",
			status: "prepare",
			modules: [
				{
					code: "hoge",
					values: {
						fuga: "piyo",
					},
				},
			],
			region: "nodeServerEngine",
			exitCode: 123,
			entryPoint: "/data/spec/entry.js",
			cost: 999,
			processName: "spec-process100",
		});
		const videoSetting: dt.VideoSetting = new dt.VideoSetting({
			instanceId: "44445555",
			videoPublishUri: "rtmp://example.nico",
			videoFrameRate: 60,
		});
		const client: DummyClient = new DummyClient();
		client.videoSetting = videoSetting;
		const result = InstanceResponse.fromDomain(instance);
		expect(result).toBeTruthy();
		expect(result.gameCode).toEqual(instance.gameCode);
		expect(result.id).toEqual(instance.id);
		expect(result.status).toEqual(instance.status);
		expect(result.modules).toEqual(instance.modules);
		expect(result.region).toEqual(instance.region);
		expect(result.exitCode).toEqual(instance.exitCode);
		expect(result.entryPoint).toEqual(instance.entryPoint);
		expect(result.cost).toEqual(instance.cost);
		expect(result.processName).toEqual(instance.processName);
		done();
	});
});
