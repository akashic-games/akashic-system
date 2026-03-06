import { GameExternalStorageTransactionProcessLike } from "@akashic/content-storage-types";
import { GameExternalStorageTransactionAccessBase } from "./GameExternalStorageTransactionAccessBase";

describe("GameExternalStorageTransactionAccessBase test", () => {
	class GameExternalStorageTransactionAccessImplMock extends GameExternalStorageTransactionAccessBase {
		protected async storageWatch(): Promise<void> {
			return;
		}
		protected async storageExec(): Promise<void> {
			return;
		}
		protected async storageDiscard(): Promise<void> {
			return;
		}
		protected async storageTransaction(key: string): Promise<GameExternalStorageTransactionProcessLike> {
			return new GameExternalStorageTransactionAccessImplMock(key, true);
		}

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

	const mock = new GameExternalStorageTransactionAccessImplMock();
	const txMock = new GameExternalStorageTransactionAccessImplMock("{hogeGameCode}", true);

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe("beginTransaction test", () => {
		describe("abnormal case", () => {
			it("req is empty.", () => {
				const req: any = null;
				mock.beginTransaction(req, (error, tx) => {
					expect(error).toBeInstanceOf(TypeError);
					expect(error?.message).toBe("req is empty.");
					expect(tx).toBe(null);
				});
			});

			it("invalid game code.", () => {
				mock.beginTransaction({}, (error, response) => {
					expect(error).toBeInstanceOf(TypeError);
					expect(error?.message).toBe("invalid game code.");
					expect(response).toBe(null);
				});
			});

			it("the transaction has already begun.", (done) => {
				// jestのspyOnはgetter/setterにしか使えないので、無理やり書き換える
				// jest.spyOn(mock as any, "isTransaction", "get").mockReturnValue(true);
				(mock as any).isTransaction = true;
				mock.beginTransaction(
					{
						gameCode: "hogeGameCode",
					},
					(error, tx) => {
						expect(error).toBeInstanceOf(Error);
						expect(error?.message).toBe("the transaction has already begun.");
						expect(tx).toBe(null);
						(mock as any).isTransaction = false;
						done();
					},
				);
			});

			it("doBeginTransaction - unexpected error - storageTransaction throws unexpected error", () => {
				jest.spyOn(mock as any, "storageTransaction").mockImplementation(() => {
					throw new Error("unexpected error");
				});
				mock.beginTransaction(
					{
						gameCode: "hogeGameCode",
					},
					(error, tx) => {
						expect(error).toBeInstanceOf(Error);
						expect(error?.message).toBe("unexpected error");
						expect(tx).toBe(null);
					},
				);
			});
		});

		describe("normal case", () => {
			it("doBeginTransaction - return tx", () => {
				mock.beginTransaction(
					{
						gameCode: "hogeGameCode",
					},
					(error, tx) => {
						expect(error).toBe(null);
						expect(tx).toBeInstanceOf(GameExternalStorageTransactionAccessImplMock);
						expect(tx).not.toBe(null);
					},
				);
			});
		});
	});

	describe("lock test", () => {
		describe("abnormal case", () => {
			it("req is empty.", () => {
				const req: any = null;
				txMock.lock(req, (error) => {
					expect(error).toBeInstanceOf(TypeError);
					expect(error?.message).toBe("req is empty.");
				});
			});

			it("invalid lock storage parameter.", () => {
				const errorMessage = "invalid lock storage parameter.";
				txMock.lock(
					{
						lockKeys: [
							{
								gameCode: "fugaGameCode",
								key: "hogeKey",
								type: "number",
								playerId: "1234",
							},
						],
					},
					(error) => {
						expect(error).toBeInstanceOf(TypeError);
						expect(error?.message).toBe(errorMessage);
					},
				);

				txMock.lock(
					{
						lockKeys: [
							{
								gameCode: "hogeGameCode",
								key: "hogeKey",
								type: "string",
								playerId: "1234",
							},
							{
								gameCode: "hogeGameCode",
								key: "hogeKey",
								type: "string",
							},
						],
					},
					(error) => {
						expect(error).toBeInstanceOf(TypeError);
						expect(error?.message).toBe(errorMessage);
					},
				);

				txMock.lock(
					{
						lockKeys: [
							{
								gameCode: "hogeGameCode",
								key: "hogeKey",
								type: "ordered-number",
							},
							{
								gameCode: "hogeGameCode",
								key: "fugaKey",
								type: "ordered-number",
								playerId: "2345",
							},
						],
					},
					(error) => {
						expect(error).toBeInstanceOf(TypeError);
						expect(error?.message).toBe(errorMessage);
					},
				);
			});

			it("doLock - unexpected error - storageWatch throws unexpected error", () => {
				jest.spyOn(txMock as any, "storageWatch").mockImplementation(() => {
					throw new Error("unexpected error");
				});
				txMock.lock(
					{
						lockKeys: [
							{
								gameCode: "hogeGameCode",
								key: "hogeKey",
								type: "ordered-number",
							},
						],
					},
					(error) => {
						expect(error).toBeInstanceOf(Error);
						expect(error?.message).toBe("unexpected error");
					},
				);
			});
		});

		describe("normal case", () => {
			it("doLock - string", () => {
				txMock.lock(
					{
						lockKeys: [
							{
								gameCode: "hogeGameCode",
								key: "hogeKey",
								type: "string",
								playerId: "1234",
							},
							{
								gameCode: "hogeGameCode",
								key: "hogeKey",
								type: "string",
								playerId: "2345",
							},
						],
					},
					(error) => {
						expect(error).toBe(null);
					},
				);
			});

			it("doLock - ordered number", () => {
				txMock.lock(
					{
						lockKeys: [
							{
								gameCode: "hogeGameCode",
								key: "hogeKey",
								type: "ordered-number",
							},
							{
								gameCode: "hogeGameCode",
								key: "fugaKey",
								type: "ordered-number",
							},
						],
					},
					(error) => {
						expect(error).toBe(null);
					},
				);
			});
		});
	});

	describe("commit test", () => {
		describe("abnormal case", () => {
			it("doCommit - locked key modified error - storageExec throws locked key modified error", () => {
				jest.spyOn(txMock as any, "storageExec").mockImplementation(() => {
					throw new Error("[LockedKeyModifiedError]hogehoge");
				});
				txMock.commit((error) => {
					expect(error).toBeInstanceOf(Error);
					expect(error?.name).toBe("LockedKeyModifiedError");
					expect(error?.message).toBe("[LockedKeyModifiedError]hogehoge");
				});
			});

			it("doCommit - unexpected error - storageExec throws unexpected error", () => {
				jest.spyOn(txMock as any, "storageExec").mockImplementation(() => {
					throw new Error("unexpected error");
				});
				txMock.commit((error) => {
					expect(error).toBeInstanceOf(Error);
					expect(error?.name).toBe("UnexpectedError");
					expect(error?.message).toBe("unexpected error");
				});
			});
		});

		describe("normal case", () => {
			it("doCommit", () => {
				txMock.commit((error) => {
					expect(error).toBe(null);
				});
			});
		});
	});

	describe("rollback test", () => {
		describe("abnormal case", () => {
			it("doRollback - unexpected error - storageDiscard throws unexpected error", () => {
				jest.spyOn(txMock as any, "storageDiscard").mockImplementation(() => {
					throw new Error("unexpected error");
				});
				txMock.rollback((error) => {
					expect(error).toBeInstanceOf(Error);
					expect(error?.message).toBe("unexpected error");
				});
			});
		});

		describe("normal case", () => {
			it("doRollback", () => {
				txMock.rollback((error) => {
					expect(error).toBe(null);
				});
			});
		});
	});
});
