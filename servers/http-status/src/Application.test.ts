import { Application } from "./Application";

describe("Application", () => {
	describe("boot method", () => {
		it("should be executed just once if be called some times", async () => {
			// setup
			const app = new Application();
			await app.initialize();

			await app.boot();
			const port1 = app.port;
			// 2回めの boot をしても、1回目と同じポートが取れるのなら、
			// おそらく同じプロセス。
			// 2回以上同じポートを使おうとすればエラーになるし、
			// 使っていたポートは返却してもすぐに再利用されたりはしない。
			await app.boot();
			const port2 = app.port;

			expect(port1).toBe(port2);

			// teardown
			await app.terminate();
		});
	});

	describe("getter", () => {
		test("port", async () => {
			// setup
			const app = new Application();

			// initialize もしてない
			expect(app.port).toBeNull();

			// initialize はした
			// boot はしてない
			await app.initialize();
			expect(app.port).toBeNull();

			// 正しい状態遷移
			await app.boot();
			expect(app.port).not.toBeNull();

			// teardown
			await app.terminate();
		});
	});

	describe("terminate", () => {
		it("should shutdown safety, before boot", async () => {
			// setup
			const app = new Application();

			// 実行時エラーとかにならなければ良い

			// initialize もしてない
			await app.terminate();

			// boot してない
			await app.initialize();
			await app.terminate();

			// 正しい状態遷移
			await app.initialize();
			await app.boot();
			await app.terminate();
		});
	});
});
