import { PlaylogSessionObserver } from "./PlaylogSessionObserver";

describe("Playlog Session Observer", () => {
	const redisRepositorySpy: any = {
		hincrby: () => {
			return Promise.resolve();
		},
	};
	let playlogSessionObserver;
	let hincrbySpy: jest.SpyInstance;

	beforeEach(() => {
		hincrbySpy = jest.spyOn(redisRepositorySpy, "hincrby");
		hincrbySpy.mockClear();
		playlogSessionObserver = new PlaylogSessionObserver("process_id_test", redisRepositorySpy);
	});

	describe("fixture test: redisRepositorySpy", () => {
		it("should returns Promise", () => {
			expect(redisRepositorySpy.hincrby("the-key", "member", 1)).toEqual(expect.any(Promise));
		});
	});

	describe("on reserve event", () => {
		it("should call hincrby() only one times", async () => {
			await playlogSessionObserver.onReserve("play_id_aaa");
			expect(hincrbySpy).toHaveBeenCalledTimes(1);
		});
	});
	describe("on start event", () => {
		it("should call hincrby() only two times", async () => {
			await playlogSessionObserver.onStart();
			expect(hincrbySpy).toHaveBeenCalledTimes(2);
		});
	});
	describe("on end event", () => {
		it("should call hincrby() only one times", async () => {
			await playlogSessionObserver.onEnd();
			expect(hincrbySpy).toHaveBeenCalledTimes(1);
		});
	});
	describe("on revoke event", () => {
		it("should call hincrby() only one times", async () => {
			await playlogSessionObserver.onRevoke();
			expect(hincrbySpy).toHaveBeenCalledTimes(1);
		});
	});
});
