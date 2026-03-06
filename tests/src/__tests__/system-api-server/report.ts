import { SystemApiClient } from "@akashic/system-api-client";
import { Errors } from "@akashic/rest-client-core";

import config from "config";

function getEndpoint(): string {
	return config.get("endpoints.system-api-server");
}

describe("play report API", () => {
	test(
		"always return INTERNAL SERVER ERROR",
		async () => {
			const client = new SystemApiClient(getEndpoint());

			// Elastic Search を立てていないので、機能しない。
			const resultFindReport: Errors.RestClientError = await client.findReports().catch((reason) => reason);
			expect(resultFindReport.body!.meta.status).toBe(500);
		},
		10 * 1000,
	);
});
