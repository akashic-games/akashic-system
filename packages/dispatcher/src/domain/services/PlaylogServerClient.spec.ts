import { PlaylogServerClient, PlaylogServerClientPool } from "./PlaylogServerClient";
import { Method } from "@akashic/rest-client-core";

describe("PlaylogServerClient", () => {
	describe("postDispatchedPlay", () => {
		// postDispatchedPlay が成功する
		it("postDispatchedPlay is successful", async () => {
			const mockBaseUrl = "http://example.com";
			const mockPlayId = "12345";
			const mockPlayToken = "token";
			const client = new PlaylogServerClient(mockBaseUrl);
			const dummyResponse = { meta: { status: 200 } };
			const mockMethod = {
				exec: jest.fn().mockResolvedValue(dummyResponse), // execute メソッドをモック
			};
			jest.spyOn(client as any, "createMethod").mockReturnValue(mockMethod as unknown as Method<any>);

			await expect(client.postDispatchedPlay(mockPlayId, mockPlayToken)).resolves.toBe(dummyResponse);
		});
	});
});

describe("PlaylogServerClientPool", () => {
	describe("get", () => {
		it("should return the same client for the same base URL", () => {
			const pool = new PlaylogServerClientPool();
			const client1 = pool.get("http://example.com");
			const client2 = pool.get("http://example.com");
			expect(client1).toBe(client2);
		});

		it("should return different clients for different base URLs", () => {
			const pool = new PlaylogServerClientPool();
			const client1 = pool.get("http://example.com");
			const client2 = pool.get("http://another-example.com");
			expect(client1).not.toBe(client2);
		});
	});
});
