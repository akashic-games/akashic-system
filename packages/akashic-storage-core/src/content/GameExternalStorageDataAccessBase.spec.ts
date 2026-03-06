import { GameExternalStorageDataAccessBase } from "./GameExternalStorageDataAccessBase";

describe("GameExternalStorageDataAccessBase test", () => {
	class GameExternalStorageDataAccessImplMock extends GameExternalStorageDataAccessBase {
		protected async storageMget(): Promise<string[]> {
			return [];
		}
		protected async storageMset(): Promise<void> {
			return;
		}
		protected async storageZadd(): Promise<void> {
			return;
		}
		protected async storageZrange(): Promise<string[]> {
			return [];
		}
		protected async storageZrank(): Promise<string> {
			return "";
		}
	}

	const mock = new GameExternalStorageDataAccessImplMock();

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe("read test", () => {
		describe("abnormal case", () => {
			it("req is empty.", () => {
				const req: any = null;
				mock.read(req, (error, response) => {
					expect(error).toBeInstanceOf(TypeError);
					expect(error?.message).toBe("req is empty.");
					expect(response).toBe(null);
				});
			});

			it("invalid read storage parameter.", () => {
				const errorMessage = "invalid read storage parameter.";
				mock.read(
					{
						key: null,
						type: "string",
					} as any,
					(error, response) => {
						expect(error).toBeInstanceOf(TypeError);
						expect(error?.message).toBe(errorMessage);
						expect(response).toBe(null);
					},
				);

				mock.read(
					{
						key: "hogeKey",
						type: "string",
					},
					(error, response) => {
						expect(error).toBeInstanceOf(TypeError);
						expect(error?.message).toBe(errorMessage);
						expect(response).toBe(null);
					},
				);

				mock.read(
					{
						key: "hogeKey",
						type: "string",
						playerIds: [],
						order: "asc",
						rankOfPlayerId: "",
					},
					(error, response) => {
						expect(error).toBeInstanceOf(TypeError);
						expect(error?.message).toBe(errorMessage);
						expect(response).toBe(null);
					},
				);

				mock.read(
					{
						key: "hogeKey",
						type: "string",
						playerIds: [],
						order: "asc",
					},
					(error, response) => {
						expect(error).toBeInstanceOf(TypeError);
						expect(error?.message).toBe(errorMessage);
						expect(response).toBe(null);
					},
				);

				mock.read(
					{
						key: "hogeKey",
						type: "string",
						order: "asc",
						rankOfPlayerId: "",
					},
					(error, response) => {
						expect(error).toBeInstanceOf(TypeError);
						expect(error?.message).toBe(errorMessage);
						expect(response).toBe(null);
					},
				);

				mock.read(
					{
						key: "hogeKey",
						type: "ordered-number",
						playerIds: [],
					},
					(error, response) => {
						expect(error).toBeInstanceOf(TypeError);
						expect(error?.message).toBe(errorMessage);
						expect(response).toBe(null);
					},
				);

				mock.read(
					{
						key: "hogeKey",
						type: "number",
						order: "asc",
					},
					(error, response) => {
						expect(error).toBeInstanceOf(TypeError);
						expect(error?.message).toBe(errorMessage);
						expect(response).toBe(null);
					},
				);

				mock.read(
					{
						key: "hogeKey",
						type: "number",
						rankOfPlayerId: "",
					},
					(error, response) => {
						expect(error).toBeInstanceOf(TypeError);
						expect(error?.message).toBe(errorMessage);
						expect(response).toBe(null);
					},
				);

				mock.read(
					{
						key: "hogeKey",
						type: "number",
						playerIds: [],
						limit: -1,
					},
					(error, response) => {
						expect(error).toBeInstanceOf(TypeError);
						expect(error?.message).toBe(errorMessage);
						expect(response).toBe(null);
					},
				);

				mock.read(
					{
						key: "hogeKey",
						type: "number",
						playerIds: [],
						offset: -1,
					},
					(error, response) => {
						expect(error).toBeInstanceOf(TypeError);
						expect(error?.message).toBe(errorMessage);
						expect(response).toBe(null);
					},
				);

				mock.read(
					{
						key: "hogeKey",
						type: "number",
						playerIds: [],
						offset: -1,
					},
					(error, response) => {
						expect(error).toBeInstanceOf(TypeError);
						expect(error?.message).toBe(errorMessage);
						expect(response).toBe(null);
					},
				);

				mock.read(
					{
						key: "hogeKey",
						type: "ordered-number",
						rankOfPlayerId: "1234",
						offset: 10,
					},
					(error, response) => {
						expect(error).toBeInstanceOf(TypeError);
						expect(error?.message).toBe(errorMessage);
						expect(response).toBe(null);
					},
				);

				mock.read(
					{
						key: "hogeKey",
						type: "ordered-number",
						rankOfPlayerId: "1234",
						limit: 100,
					},
					(error, response) => {
						expect(error).toBeInstanceOf(TypeError);
						expect(error?.message).toBe(errorMessage);
						expect(response).toBe(null);
					},
				);
			});

			it("request playScope is not available.", () => {
				mock.read(
					{
						gameCode: "hogeGameCode",
						key: "hogeKey",
						type: "ordered-number",
						order: "asc",
						playScope: "play",
					},
					(error, response) => {
						expect(error).toBeInstanceOf(TypeError);
						expect(error?.message).toBe("request playScope (play) is not available.");
						expect(response).toBe(null);
					},
				);

				mock.read(
					{
						gameCode: "hogeGameCode",
						key: "hogeKey",
						type: "ordered-number",
						order: "asc",
						playScope: "rootPlay",
					},
					(error, response) => {
						expect(error).toBeInstanceOf(TypeError);
						expect(error?.message).toBe("request playScope (rootPlay) is not available.");
						expect(response).toBe(null);
					},
				);

				mock.read(
					{
						gameCode: "hogeGameCode",
						key: "hogeKey",
						type: "ordered-number",
						order: "asc",
						playScope: "hoge",
					} as any,
					(error, response) => {
						expect(error).toBeInstanceOf(TypeError);
						expect(error?.message).toBe("request playScope (hoge) is not available.");
						expect(response).toBe(null);
					},
				);
			});

			it("invalid game code.", () => {
				mock.read(
					{
						key: "hogeKey",
						type: "ordered-number",
						order: "asc",
					},
					(error, response) => {
						expect(error).toBeInstanceOf(TypeError);
						expect(error?.message).toBe("invalid game code.");
						expect(response).toBe(null);
					},
				);
			});

			it("doReadOrder - invalid read storage result. - result is null", () => {
				jest.spyOn(mock as any, "storageZrange").mockReturnValue(null);
				mock.read(
					{
						gameCode: "hogeGameCode",
						key: "hogeKey",
						type: "ordered-number",
						order: "asc",
					},
					(error, response) => {
						expect(error).toBeInstanceOf(Error);
						expect(error?.message).toBe("invalid read storage result.");
						expect(response).toBe(null);
					},
				);
			});

			it("doReadOrder - invalid read storage result. - result is invalid", () => {
				jest.spyOn(mock as any, "storageZrange").mockReturnValue(["1234:1", "2345:2", ":3"]);
				mock.read(
					{
						gameCode: "hogeGameCode",
						key: "hogeKey",
						type: "ordered-number",
						order: "asc",
					},
					(error, response) => {
						expect(error).toBeInstanceOf(Error);
						expect(error?.message).toBe("invalid read storage result.");
						expect(response).toBe(null);
					},
				);
			});

			it("doReadPlayers - invalid read storage result. - result is null", () => {
				jest.spyOn(mock as any, "storageMget").mockReturnValue(null);
				mock.read(
					{
						gameCode: "hogeGameCode",
						key: "hogeKey",
						type: "number",
						playerIds: ["1234"],
					},
					(error, response) => {
						expect(error).toBeInstanceOf(Error);
						expect(error?.message).toBe("invalid read storage result.");
						expect(response).toBe(null);
					},
				);
			});

			it("doReadPlayers - unexpected error. - result throws unexpected error", () => {
				jest.spyOn(mock as any, "storageMget").mockImplementation(() => {
					throw new Error("unexpected error");
				});
				mock.read(
					{
						gameCode: "hogeGameCode",
						key: "hogeKey",
						type: "number",
						playerIds: ["1234"],
					},
					(error, response) => {
						expect(error).toBeInstanceOf(Error);
						expect(error?.message).toBe("unexpected error");
						expect(response).toBe(null);
					},
				);
			});
		});

		describe("normal case", () => {
			it("doReadOrder - asc", () => {
				jest.spyOn(mock as any, "storageZrange").mockReturnValue(["1234:1", "2345:2", "3456:3"]);
				mock.read(
					{
						gameCode: "hogeGameCode",
						key: "hogeKey",
						type: "ordered-number",
						order: "asc",
					},
					(error, response) => {
						expect(error).toBe(null);
						expect(response).toEqual({
							gameCode: "hogeGameCode",
							key: "hogeKey",
							playScope: "global",
							type: "ordered-number",
							data: [
								{
									playerId: "1234",
									value: 1,
								},
								{
									playerId: "2345",
									value: 2,
								},
								{
									playerId: "3456",
									value: 3,
								},
							],
						});
					},
				);
			});

			it("doReadOrder - desc", () => {
				jest.spyOn(mock as any, "storageZrange").mockReturnValue(["1234:1", "2345:2", "3456:3"]);
				mock.read(
					{
						gameCode: "hogeGameCode",
						key: "hogeKey",
						type: "ordered-number",
						order: "desc",
					},
					(error, response) => {
						expect(error).toBe(null);
						expect(response).toEqual({
							gameCode: "hogeGameCode",
							key: "hogeKey",
							playScope: "global",
							type: "ordered-number",
							data: [
								{
									playerId: "3456",
									value: 3,
								},
								{
									playerId: "2345",
									value: 2,
								},
								{
									playerId: "1234",
									value: 1,
								},
							],
						});
					},
				);
			});

			it("doReadRank - rank 1", () => {
				jest.spyOn(mock as any, "storageZrank").mockReturnValue("1");
				mock.read(
					{
						gameCode: "hogeGameCode",
						key: "hogeKey",
						type: "ordered-number",
						rankOfPlayerId: "1234",
					},
					(error, response) => {
						expect(error).toBe(null);
						expect(response).toEqual({
							gameCode: "hogeGameCode",
							key: "hogeKey",
							playScope: "global",
							type: "ordered-number",
							data: [
								{
									playerId: "1234",
									value: 1,
								},
							],
						});
					},
				);
			});

			it("doReadRank - rank null", () => {
				jest.spyOn(mock as any, "storageZrank").mockReturnValue(null);
				mock.read(
					{
						gameCode: "hogeGameCode",
						key: "hogeKey",
						type: "ordered-number",
						rankOfPlayerId: "noPlayer",
					},
					(error, response) => {
						expect(error).toBe(null);
						expect(response).toEqual({
							gameCode: "hogeGameCode",
							key: "hogeKey",
							playScope: "global",
							type: "ordered-number",
							data: [
								{
									playerId: "noPlayer",
									value: null,
								},
							],
						});
					},
				);
			});

			it("doReadPlayers - valueType is string", () => {
				jest.spyOn(mock as any, "storageMget").mockReturnValue(["hoge", "fuga"]);
				mock.read(
					{
						gameCode: "hogeGameCode",
						key: "hogeKey",
						type: "string",
						playerIds: ["1234", "2345"],
					},
					(error, response) => {
						expect(error).toBe(null);
						expect(response).toEqual({
							gameCode: "hogeGameCode",
							key: "hogeKey",
							playScope: "global",
							type: "string",
							data: [
								{
									playerId: "1234",
									value: "hoge",
								},
								{
									playerId: "2345",
									value: "fuga",
								},
							],
						});
					},
				);
			});

			it("doReadPlayers - valueType is general", () => {
				jest.spyOn(mock as any, "storageMget").mockReturnValue([
					`{
						"hoge": "fuga"
					}`,
					`{
						"hoge": "piyo"
					}`,
				]);
				mock.read(
					{
						gameCode: "hogeGameCode",
						key: "hogeKey",
						type: "general",
						playerIds: ["1234", "2345"],
					},
					(error, response) => {
						expect(error).toBe(null);
						expect(response).toEqual({
							gameCode: "hogeGameCode",
							key: "hogeKey",
							playScope: "global",
							type: "general",
							data: [
								{
									playerId: "1234",
									value: {
										hoge: "fuga",
									},
								},
								{
									playerId: "2345",
									value: {
										hoge: "piyo",
									},
								},
							],
						});
					},
				);
			});

			it("doReadPlayers - value is null", () => {
				jest.spyOn(mock as any, "storageMget").mockReturnValue([null, null]);
				mock.read(
					{
						gameCode: "hogeGameCode",
						key: "hogeKey",
						type: "general",
						playerIds: ["1234", "2345"],
					},
					(error, response) => {
						expect(error).toBe(null);
						expect(response).toEqual({
							gameCode: "hogeGameCode",
							key: "hogeKey",
							playScope: "global",
							type: "general",
							data: [
								{
									playerId: "1234",
									value: null,
								},
								{
									playerId: "2345",
									value: null,
								},
							],
						});
					},
				);
			});

			it("doReadPlayers - value is invalid json", () => {
				jest.spyOn(mock as any, "storageMget").mockReturnValue(["invalid json", "invalid json"]);
				mock.read(
					{
						gameCode: "hogeGameCode",
						key: "hogeKey",
						type: "general",
						playerIds: ["1234", "2345"],
					},
					(error, response) => {
						expect(error).toBe(null);
						expect(response).toEqual({
							gameCode: "hogeGameCode",
							key: "hogeKey",
							playScope: "global",
							type: "general",
							data: [
								{
									playerId: "1234",
									value: null,
								},
								{
									playerId: "2345",
									value: null,
								},
							],
						});
					},
				);
			});

			it("doReadPlayers - valueType is unknown", () => {
				jest.spyOn(mock as any, "storageMget").mockReturnValue(["hoge", "piyo"]);
				mock.read(
					{
						gameCode: "hogeGameCode",
						key: "hogeKey",
						type: "unknown",
						playerIds: ["1234", "2345"],
					} as any,
					(error, response) => {
						expect(error).toBe(null);
						expect(response).toEqual({
							gameCode: "hogeGameCode",
							key: "hogeKey",
							playScope: "global",
							type: "unknown",
							data: [
								{
									playerId: "1234",
									value: null,
								},
								{
									playerId: "2345",
									value: null,
								},
							],
						});
					},
				);
			});
		});
	});

	describe("write test", () => {
		describe("abnormal case", () => {
			it("req is empty.", () => {
				const req: any = null;
				mock.write(req, (error, response) => {
					expect(error).toBeInstanceOf(TypeError);
					expect(error?.message).toBe("req is empty.");
					expect(response).toBe(null);
				});
			});

			it("invalid write storage parameter.", () => {
				const errorMessage = "invalid write storage parameter.";
				mock.write(
					{
						key: null,
						type: "string",
					} as any,
					(error, response) => {
						expect(error).toBeInstanceOf(TypeError);
						expect(error?.message).toBe(errorMessage);
						expect(response).toBe(null);
					},
				);

				mock.write(
					{
						key: "hogeKey",
						type: "string",
						data: null,
					} as any,
					(error, response) => {
						expect(error).toBeInstanceOf(TypeError);
						expect(error?.message).toBe(errorMessage);
						expect(response).toBe(null);
					},
				);
			});

			it("doWriteOrder - notPermitted - valueType is string", () => {
				mock.write(
					{
						gameCode: "hogeGameCode",
						key: "hogeKey",
						type: "ordered-number",
						writeType: "overwrite",
						data: [
							{
								playerId: "1234",
								value: "not a number",
							},
							{
								playerId: "2345",
								value: 2,
							},
						],
					},
					(error, response) => {
						expect(error).toBe(null);
						expect(response).toEqual({
							failed: [
								{
									failureType: "notPermitted",
									gameCode: "hogeGameCode",
									key: "hogeKey",
									message: "valueの型がリクエストの型と異なります（value:not a number, type:ordered-number）",
									playScope: "global",
									playerId: "1234",
									type: "ordered-number",
								},
							],
						});
					},
				);
			});

			it("doWriteOrder - notPermitted - incr value is string", () => {
				jest.spyOn(mock as any, "storageZrange").mockReturnValue(["1234:1", "2345:2"]);
				mock.write(
					{
						gameCode: "hogeGameCode",
						key: "hogeKey",
						type: "ordered-number",
						writeType: "incr",
						data: [
							{
								playerId: "1234",
								value: "not a number",
							},
							{
								playerId: "2345",
								value: 2,
							},
						],
					},
					(error, response) => {
						expect(error).toBe(null);
						expect(response).toEqual({
							failed: [
								{
									failureType: "notPermitted",
									gameCode: "hogeGameCode",
									key: "hogeKey",
									message: "valueの値が不正です（value:NaN, type:ordered-number）",
									playScope: "global",
									playerId: "1234",
									type: "ordered-number",
								},
							],
						});
					},
				);
			});

			it("doWriteOrder - subceedMin - min is 10", () => {
				mock.write(
					{
						gameCode: "hogeGameCode",
						key: "hogeKey",
						type: "ordered-number",
						writeType: "overwrite",
						min: 10,
						data: [
							{
								playerId: "1234",
								value: 1,
							},
							{
								playerId: "2345",
								value: 2,
							},
						],
					},
					(error, response) => {
						expect(error).toBe(null);
						expect(response).toEqual({
							failed: [
								{
									failureType: "subceedMin",
									gameCode: "hogeGameCode",
									key: "hogeKey",
									message: "valueがリクエストのmin値を下回りました（value:1, min:10）",
									playScope: "global",
									playerId: "1234",
									type: "ordered-number",
								},
								{
									failureType: "subceedMin",
									gameCode: "hogeGameCode",
									key: "hogeKey",
									message: "valueがリクエストのmin値を下回りました（value:2, min:10）",
									playScope: "global",
									playerId: "2345",
									type: "ordered-number",
								},
							],
						});
					},
				);
			});

			it("doWriteOrder - exceedMax - max is 1", () => {
				mock.write(
					{
						gameCode: "hogeGameCode",
						key: "hogeKey",
						type: "ordered-number",
						writeType: "overwrite",
						max: 1,
						data: [
							{
								playerId: "1234",
								value: 1,
							},
							{
								playerId: "2345",
								value: 2,
							},
						],
					},
					(error, response) => {
						expect(error).toBe(null);
						expect(response).toEqual({
							failed: [
								{
									failureType: "exceedMax",
									gameCode: "hogeGameCode",
									key: "hogeKey",
									message: "valueがリクエストのmax値を上回りました（value:2, max:1）",
									playScope: "global",
									playerId: "2345",
									type: "ordered-number",
								},
							],
						});
					},
				);
			});

			it("doWritePlayers - notPermitted - value is number and valueType is string", () => {
				mock.write(
					{
						gameCode: "hogeGameCode",
						key: "hogeKey",
						type: "string",
						writeType: "overwrite",
						data: [
							{
								playerId: "1234",
								value: 1,
							},
						],
					},
					(error, response) => {
						expect(error).toBe(null);
						expect(response).toEqual({
							failed: [
								{
									failureType: "notPermitted",
									gameCode: "hogeGameCode",
									key: "hogeKey",
									message: "valueの型がリクエストの型と異なります（value:1, type:string）",
									playScope: "global",
									playerId: "1234",
									type: "string",
								},
							],
						});
					},
				);
			});

			it("doWritePlayers - notPermitted - value is not object and valueType is general", () => {
				mock.write(
					{
						gameCode: "hogeGameCode",
						key: "hogeKey",
						type: "general",
						writeType: "overwrite",
						data: [
							{
								playerId: "1234",
								value: "not a object",
							},
							{
								playerId: "2345",
								value: {
									hoge: "fuga",
								},
							},
						],
					},
					(error, response) => {
						expect(error).toBe(null);
						expect(response).toEqual({
							failed: [
								{
									failureType: "notPermitted",
									gameCode: "hogeGameCode",
									key: "hogeKey",
									message: "valueの型がリクエストの型と異なります（value:not a object, type:general）",
									playScope: "global",
									playerId: "1234",
									type: "general",
								},
							],
						});
					},
				);
			});

			it("doWritePlayers - notPermitted - value is object and valueType is not general", () => {
				mock.write(
					{
						gameCode: "hogeGameCode",
						key: "hogeKey",
						type: "number",
						writeType: "overwrite",
						data: [
							{
								playerId: "1234",
								value: {
									hoge: "piyo",
								},
							},
						],
					},
					(error, response) => {
						expect(error).toBe(null);
						expect(response).toEqual({
							failed: [
								{
									failureType: "notPermitted",
									gameCode: "hogeGameCode",
									key: "hogeKey",
									message: "valueの値が不正です（value:[object Object], type:number）",
									playScope: "global",
									playerId: "1234",
									type: "number",
								},
							],
						});
					},
				);
			});

			it("doWritePlayers - notPermitted - decr value is string", () => {
				jest.spyOn(mock as any, "storageZrange").mockReturnValue(["1234:1", "2345:2"]);
				mock.write(
					{
						gameCode: "hogeGameCode",
						key: "hogeKey",
						type: "number",
						writeType: "decr",
						data: [
							{
								playerId: "1234",
								value: "not a number",
							},
							{
								playerId: "2345",
								value: 2,
							},
						],
					},
					(error, response) => {
						expect(error).toBe(null);
						expect(response).toEqual({
							failed: [
								{
									failureType: "notPermitted",
									gameCode: "hogeGameCode",
									key: "hogeKey",
									message: "valueの値が不正です（value:NaN, type:number）",
									playScope: "global",
									playerId: "1234",
									type: "number",
								},
							],
						});
					},
				);
			});

			it("doWritePlayers - subceedMin - min is 10", () => {
				mock.write(
					{
						gameCode: "hogeGameCode",
						key: "hogeKey",
						type: "number",
						writeType: "overwrite",
						min: 10,
						data: [
							{
								playerId: "1234",
								value: 1,
							},
							{
								playerId: "2345",
								value: 2,
							},
						],
					},
					(error, response) => {
						expect(error).toBe(null);
						expect(response).toEqual({
							failed: [
								{
									failureType: "subceedMin",
									gameCode: "hogeGameCode",
									key: "hogeKey",
									message: "valueがリクエストのmin値を下回りました（value:1, min:10）",
									playScope: "global",
									playerId: "1234",
									type: "number",
								},
								{
									failureType: "subceedMin",
									gameCode: "hogeGameCode",
									key: "hogeKey",
									message: "valueがリクエストのmin値を下回りました（value:2, min:10）",
									playScope: "global",
									playerId: "2345",
									type: "number",
								},
							],
						});
					},
				);
			});

			it("doWritePlayers - exceedMax - max is 1", () => {
				mock.write(
					{
						gameCode: "hogeGameCode",
						key: "hogeKey",
						type: "number",
						writeType: "overwrite",
						max: 1,
						data: [
							{
								playerId: "1234",
								value: 1,
							},
							{
								playerId: "2345",
								value: 2,
							},
						],
					},
					(error, response) => {
						expect(error).toBe(null);
						expect(response).toEqual({
							failed: [
								{
									failureType: "exceedMax",
									gameCode: "hogeGameCode",
									key: "hogeKey",
									message: "valueがリクエストのmax値を上回りました（value:2, max:1）",
									playScope: "global",
									playerId: "2345",
									type: "number",
								},
							],
						});
					},
				);
			});
		});

		describe("normal case", () => {
			it("doWriteOrder - incr", () => {
				mock.write(
					{
						gameCode: "hogeGameCode",
						key: "hogeKey",
						type: "ordered-number",
						writeType: "incr",
						max: 10,
						playScope: "play",
						playId: "98765",
						data: [
							{
								playerId: "1234",
								value: 1,
							},
							{
								playerId: "2345",
								value: 2,
							},
						],
					} as any,
					(error, response) => {
						expect(error).toBe(null);
						expect(response).toEqual({ failed: [] });
					},
				);
			});

			it("doWriteOrder - decr", () => {
				jest.spyOn(mock as any, "storageZrange").mockReturnValue(["1234:1", "2345:2"]);
				mock.write(
					{
						gameCode: "hogeGameCode",
						key: "hogeKey",
						type: "ordered-number",
						writeType: "decr",
						min: 0,
						playScope: "rootPlay",
						playId: "98765",
						data: [
							{
								playerId: "1234",
								value: 1,
							},
							{
								playerId: "2345",
								value: 2,
							},
						],
					} as any,
					(error, response) => {
						expect(error).toBe(null);
						expect(response).toEqual({ failed: [] });
					},
				);
			});

			it("doWritePlayers - incr", () => {
				mock.write(
					{
						gameCode: "hogeGameCode",
						key: "hogeKey",
						type: "number",
						writeType: "incr",
						max: 10,
						playScope: "play",
						playId: "98765",
						data: [
							{
								playerId: "1234",
								value: 1,
							},
							{
								playerId: "2345",
								value: 2,
							},
						],
					} as any,
					(error, response) => {
						expect(error).toBe(null);
						expect(response).toEqual({ failed: [] });
					},
				);
			});

			it("doWritePlayers - decr", () => {
				jest.spyOn(mock as any, "storageZrange").mockReturnValue(["1234:1", "2345:2"]);
				mock.write(
					{
						gameCode: "hogeGameCode",
						key: "hogeKey",
						type: "number",
						writeType: "decr",
						min: -2,
						playScope: "rootPlay",
						playId: "98765",
						data: [
							{
								playerId: "1234",
								value: 1,
							},
							{
								playerId: "2345",
								value: 2,
							},
						],
					} as any,
					(error, response) => {
						expect(error).toBe(null);
						expect(response).toEqual({ failed: [] });
					},
				);
			});

			it("doWritePlayers - string", () => {
				mock.write(
					{
						gameCode: "hogeGameCode",
						key: "hogeKey",
						type: "string",
						writeType: "overwrite",
						data: [
							{
								playerId: "1234",
								value: "hoge",
							},
							{
								playerId: "2345",
								value: "fuga",
							},
						],
					},
					(error, response) => {
						expect(error).toBe(null);
						expect(response).toEqual({ failed: [] });
					},
				);
			});

			it("doWritePlayers - general", () => {
				mock.write(
					{
						gameCode: "hogeGameCode",
						key: "hogeKey",
						type: "general",
						writeType: "overwrite",
						data: [
							{
								playerId: "1234",
								value: {
									hoge: "hoge",
									fuga: "fuga",
								},
							},
							{
								playerId: "2345",
								value: {
									hoge: "hoge",
									fuga: "fuga",
								},
							},
						],
					},
					(error, response) => {
						expect(error).toBe(null);
						expect(response).toEqual({ failed: [] });
					},
				);
			});
		});
	});
});
