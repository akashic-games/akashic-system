import { default as request } from "supertest";
import apiRoute from "./testRoute";

describe("GET /healthcheck", () => {
	it("成功時は200を返す", (done) => {
		request(apiRoute)
			.get("/healthcheck")
			.end((err, response) => {
				expect(response.status).toEqual(200);
				done();
			});
	});
});
