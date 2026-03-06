import { LogUtil } from "@akashic/log-util";
import { Session } from "@akashic/playlog-server-engine";
import { PlaylogHandler } from "../PlaylogHandler";
import { RequestHandler } from "../RequestHandler";
import { ServerEngineAMFlow } from "../ServerEngineAMFlow";
import { PlayTokenValidator } from "../PlayTokenValidator";
import { SystemControlAPIHandler } from "../SystemControlAPIHandler";
import { Play } from "@akashic/server-engine-data-types";
import * as log4js from "log4js";
import { PlayTokenHolder } from "../PlayTokenHolder";
import { PlayToken } from "@akashic/server-engine-data-types";
import { AMFlowLike } from "@akashic/playlog-server-engine";

describe("ServerEngineAMFlow", () => {
	// ServerEngineAMFlowの組み立てに必要なMock
	const PlaylogHandlerMock = jest.fn<PlaylogHandler, []>();
	const RequestHandlerMock = jest.fn<RequestHandler, []>();
	const SystemControlAPIHandlerMock = jest.fn<SystemControlAPIHandler, []>();
	const PlayTokenValidatorMock = jest.fn<PlayTokenValidator, []>();
	const SessionMock = jest.fn<Session, []>();
	const TokenHolderMock = jest.fn<PlayTokenHolder, []>();

	it("gameCodeがnicocas以外ならgetRawTickListが呼び出される", async () => {
		// 組み立てに必要なモックのインスタンス
		const playlogHandler = new PlaylogHandlerMock();
		const requestHandler = new RequestHandlerMock();
		const systemControlAPIHandler = new SystemControlAPIHandlerMock();
		const playTokenValidator = new PlayTokenValidatorMock();
		const sessionMock = new SessionMock();
		const logger = new LogUtil(log4js.getLogger("out"));

		// 内部で呼び出される関数のモックを作成
		const getRawTickListMock = jest.fn().mockImplementation(async () => {
			return new Buffer("");
		});
		requestHandler.getRawTickList = getRawTickListMock;
		const getRawTickListExcludedIgnorableMock = jest.fn().mockImplementation(async () => {
			return new Buffer("");
		});
		requestHandler.getRawTickListExcludedIgnorable = getRawTickListExcludedIgnorableMock;

		// getRawTickListを実行する為readTickのパーミッションだけ持つようにする
		playTokenValidator.validate = jest.fn().mockImplementation(async () => {
			const holderMock = new TokenHolderMock();
			holderMock.on = jest.fn().mockImplementation(() => {
				/* undefinedではなくする */
			});
			const playToken = new PlayToken({
				playId: "1",
				value: "",
				hash: "",
				expire: new Date(),
				permission: {
					writeTick: false,
					readTick: true,
					sendEvent: false,
					subscribeEvent: false,
					subscribeTick: false,
					maxEventPriority: 0,
				},
			});

			Object.defineProperty(holderMock, "playToken", {
				value: playToken,
			});
			return holderMock;
		});

		// gameCodeがnicocasではないPlayを返す
		systemControlAPIHandler.getPlay = jest.fn().mockImplementation(async () => {
			return new Play({
				gameCode: "game-fish",
				started: new Date(),
				status: "running",
			});
		});

		const serverEngineAMFlow: AMFlowLike = new ServerEngineAMFlow(
			{
				playlog: playlogHandler,
				request: requestHandler,
				systemControlAPI: systemControlAPIHandler,
				playTokenValidator,
			},
			logger,
			{
				mainPlayer: 300,
				subPlayer: 300,
			},
			sessionMock,
		);

		serverEngineAMFlow.authenticate("", (err: Error) => {
			serverEngineAMFlow.getRawTickList(0, 10, (err: Error, tickList: Buffer[]) => {
				expect(getRawTickListMock.mock.calls.length).toEqual(1);
				expect(getRawTickListExcludedIgnorableMock.mock.calls.length).toEqual(0);
			});
		});
	});

	it("gameCodeがnicocas以外ならgetRawTickListが呼び出される", async () => {
		// 組み立てに必要なモックのインスタンス
		const playlogHandler = new PlaylogHandlerMock();
		const requestHandler = new RequestHandlerMock();
		const systemControlAPIHandler = new SystemControlAPIHandlerMock();
		const playTokenValidator = new PlayTokenValidatorMock();
		const sessionMock = new SessionMock();
		const logger = new LogUtil(log4js.getLogger("out"));

		// 内部で呼び出される関数のモックを作成
		const getRawTickListMock = jest.fn().mockImplementation(async () => {
			return new Buffer("");
		});
		requestHandler.getRawTickList = getRawTickListMock;
		const getRawTickListExcludedIgnorableMock = jest.fn().mockImplementation(async () => {
			return new Buffer("");
		});
		requestHandler.getRawTickListExcludedIgnorable = getRawTickListExcludedIgnorableMock;

		// getRawTickListを実行する為readTickのパーミッションだけ持つようにする
		playTokenValidator.validate = jest.fn().mockImplementation(async () => {
			const holderMock = new TokenHolderMock();
			holderMock.on = jest.fn().mockImplementation(() => {
				/* undefinedではなくする */
			});
			const playToken = new PlayToken({
				playId: "1",
				value: "",
				hash: "",
				expire: new Date(),
				permission: {
					writeTick: false,
					readTick: true,
					sendEvent: false,
					subscribeEvent: false,
					subscribeTick: false,
					maxEventPriority: 0,
				},
			});

			Object.defineProperty(holderMock, "playToken", {
				value: playToken,
			});
			return holderMock;
		});

		// gameCodeがnicocasであるPlayを返す
		systemControlAPIHandler.getPlay = jest.fn().mockImplementation(async () => {
			return new Play({
				gameCode: "nicocas",
				started: new Date(),
				status: "running",
			});
		});

		const serverEngineAMFlow: AMFlowLike = new ServerEngineAMFlow(
			{
				playlog: playlogHandler,
				request: requestHandler,
				systemControlAPI: systemControlAPIHandler,
				playTokenValidator,
			},
			logger,
			{
				mainPlayer: 300,
				subPlayer: 300,
			},
			sessionMock,
		);

		serverEngineAMFlow.authenticate("", (err: Error) => {
			serverEngineAMFlow.getRawTickList(0, 10, (err: Error, tickList: Buffer[]) => {
				expect(getRawTickListMock.mock.calls.length).toEqual(0);
				expect(getRawTickListExcludedIgnorableMock.mock.calls.length).toEqual(1);
			});
		});
	});
});
