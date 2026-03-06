import { BaseApiClient, MethodInfo } from "./BaseApiClient";
import { Method } from "@akashic/rest-client-core";

class WrapperApiClient extends BaseApiClient {
	constructor(baseUrl: string) {
		super(baseUrl);
	}
	createMethod<T>(methodInfo: MethodInfo, castData?: (data: any) => T, options?: any): Method<T> {
		return super.createMethod<T>(methodInfo, castData, options);
	}
}

describe("BaseApiClient", () => {
	const mockMethodFactory = jest.fn();
	const mockBaseUrl = "https://api.example.com";

	beforeEach(() => {
		mockMethodFactory.mockReset();
	});

	describe("constructor", () => {
		it("should initialize with the correct baseUrl", () => {
			const client = new WrapperApiClient(mockBaseUrl);
			expect(client.baseUrl).toBe(mockBaseUrl);
		});

		it("should remove trailing slash from baseUrl", () => {
			const client = new WrapperApiClient(mockBaseUrl + "/");
			expect(client.baseUrl).toBe(mockBaseUrl);
		});
	});

	describe("createMethod", () => {
		it("createMethod returns Method", () => {
			const client = new WrapperApiClient(mockBaseUrl);
			const methodInfo: MethodInfo = { path: "/test", method: "GET" };

			expect(client.createMethod<{}>(methodInfo)).toBeInstanceOf(Method);
			// Method の中身は確認できないし、このテストの範疇外であるため、型だけ確認する
		});
	});
});
