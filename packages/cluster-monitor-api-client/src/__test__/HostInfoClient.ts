jest.mock("@akashic/rest-client-core", () => ({
	Method: jest.fn(() => ({
		exec: jest.fn(() =>
			Promise.resolve({
				meta: {
					status: 200,
				},
				data: {
					values: ["host0.domain.jp", "host1.domain.jp"],
					totalCount: "2",
				},
			}),
		),
	})),
}));
import { HostInfoClient } from "../";

describe("host info client", () => {
	it("can get hosts", async () => {
		// 期待したデータを取得できることを確認
		const client = new HostInfoClient("http://localhost:16000/");
		const hosts = await client.getHosts();

		// 型の都合もあるので、ガード節
		if (hosts.data == null) {
			fail();
		}

		expect(hosts.data.values[0]).toEqual("host0.domain.jp");
		expect(hosts.data.values[1]).toEqual("host1.domain.jp");
		expect(hosts.data.totalCount).toEqual("2");
	});
});
