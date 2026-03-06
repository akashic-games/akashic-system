import * as dt from "@akashic/server-engine-data-types";
import InstancesResponse from "./InstancesResponse";

class DummyClient {
	public videoSettings: dt.VideoSetting[];
	public getVideoSettings() {
		return Promise.resolve({
			data: new dt.PagingResponse({ values: this.videoSettings }),
		});
	}
}

describe("InstancesResponse", () => {
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
			region: "akashicCluster",
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
		client.videoSettings = [videoSetting];
		const result: InstancesResponse = InstancesResponse.fromDomainAndClient([instance], undefined);
		expect(result).toBeTruthy();
		expect(result.values[0].gameCode).toEqual(instance.gameCode);
		expect(result.values[0].id).toEqual(instance.id);
		expect(result.values[0].status).toEqual(instance.status);
		expect(result.values[0].modules).toEqual(instance.modules);
		expect(result.values[0].region).toEqual(instance.region);
		expect(result.values[0].exitCode).toEqual(instance.exitCode);
		expect(result.values[0].entryPoint).toEqual(instance.entryPoint);
		expect(result.values[0].cost).toEqual(instance.cost);
		expect(result.values[0].processName).toEqual(instance.processName);
		done();
	});
});
