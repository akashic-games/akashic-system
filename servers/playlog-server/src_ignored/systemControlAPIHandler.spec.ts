import * as lu from "@akashic/log-util";
import * as log4js from "log4js";
import * as nock from "nock";
import MockSystemControlServer from "./MockSystemControlServer";
import { SystemControlAPIHandler } from "./SystemControlAPIHandler";

const logger = new lu.LogUtil(log4js.getLogger("out"));

// CI で動かすのが困難なので、無効化
xdescribe("SystemControlAPIHandler", () => {
	beforeEach(() => {
		this.handler = new SystemControlAPIHandler(logger);
	});

	afterEach(() => {
		nock.cleanAll();
	});

	it("should get play", async (done) => {
		const playId = "200";
		const handler = this.handler;
		new MockSystemControlServer().getPlay(200, {
			playId,
			gameCode: "mygame",
		});
		try {
			const play = await handler.getPlay("200");
			expect(play.gameCode).toBe("mygame");
			done();
		} catch (error) {
			done.fail(error);
		}
	});
});
