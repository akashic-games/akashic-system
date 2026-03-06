import { Application } from "../";
import { get } from "http";

test("start to end", async () => {
	const app = new Application();
	await app.initialize();
	await app.boot();

	expect(app.port).not.toBeNull();

	// 戻り値の Http Request Client の on error は無視して良いので握りつぶす
	get(`http://localhost:${app.port}/200`, (res) => expect(res.statusCode).toBe(200)).on("error", () => {
		// nothing
	});

	get(`http://localhost:${app.port}/200/foo/bar`, (res) => expect(res.statusCode).toBe(200)).on("error", () => {
		// nothing
	});

	get(`http://localhost:${app.port}/502`, (res) => expect(res.statusCode).toBe(502)).on("error", () => {
		// nothing
	});

	get(`http://localhost:${app.port}/502/foo/bar`, (res) => expect(res.statusCode).toBe(502)).on("error", () => {
		// nothing
	});

	await app.terminate();
});
