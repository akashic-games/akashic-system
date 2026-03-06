import config from "config";
import { RedisCommander, Redis } from "ioredis";
import ContentStorageService from "../ContentStorageService";

describe("ContentStorageService Feature", () => {
	// Redis
	const contentStorageRedisClient: RedisCommander = new Redis(
		config.get("contentStorage.redis.port"),
		config.get("contentStorage.redis.host"),
		config.get("contentStorage.redis.option"),
	);

	const contentStorageService = new ContentStorageService(contentStorageRedisClient);

	// 前に実行された it に依存する it が含まれる describe があるので、 beforeEach にできない。
	beforeAll(async () => {
		const keys = await contentStorageRedisClient.keys("{test-content-storage}*");
		if (keys.length > 0) {
			await contentStorageRedisClient.del(keys);
		}
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe("basic usage", () => {
		describe("ValueType is string", () => {
			it("can write", async () => {
				const result = await contentStorageService.write({
					gameCode: "test-content-storage",
					key: "test_content_storage_string",
					type: "string",
					data: [
						{
							playerId: "1234",
							value: "hoge_value",
						},
						{
							playerId: "2345",
							value: "fuga_value",
						},
						{
							playerId: "3456",
							value: "piyo_value",
						},
					],
				});

				expect(result).toEqual({
					failed: [],
				});
			});

			it("can read", async () => {
				const result = await contentStorageService.read({
					gameCode: "test-content-storage",
					key: "test_content_storage_string",
					playerIds: ["1234", "2345", "3456", "0000"],
					type: "string",
				});

				expect(result).toEqual({
					gameCode: "test-content-storage",
					playScope: "global",
					key: "test_content_storage_string",
					type: "string",
					data: [
						{
							playerId: "1234",
							value: "hoge_value",
						},
						{
							playerId: "2345",
							value: "fuga_value",
						},
						{
							playerId: "3456",
							value: "piyo_value",
						},
						{
							playerId: "0000",
							value: null,
						},
					],
				});
			});
		});

		describe("ValueType is ordered-number", () => {
			it("can write", async () => {
				const result = await contentStorageService.write({
					gameCode: "test-content-storage",
					key: "test_content_storage_ordered_number",
					type: "ordered-number",
					min: 0,
					max: 100,
					data: [
						{
							playerId: "1234",
							value: 0.5,
						},
						{
							playerId: "2345",
							value: 15,
						},
						{
							playerId: "3456",
							value: 42.3,
						},
					],
				});
				expect(result).toEqual({
					failed: [],
				});
			});

			it("can read - order is asc", async () => {
				const result = await contentStorageService.read({
					gameCode: "test-content-storage",
					key: "test_content_storage_ordered_number",
					type: "ordered-number",
					order: "asc",
				});

				expect(result).toEqual({
					gameCode: "test-content-storage",
					playScope: "global",
					key: "test_content_storage_ordered_number",
					type: "ordered-number",
					data: [
						{
							playerId: "1234",
							value: 0.5,
						},
						{
							playerId: "2345",
							value: 15,
						},
						{
							playerId: "3456",
							value: 42.3,
						},
					],
				});
			});

			it("can read - order is desc", async () => {
				const result = await contentStorageService.read({
					gameCode: "test-content-storage",
					key: "test_content_storage_ordered_number",
					type: "ordered-number",
					order: "desc",
				});

				expect(result).toEqual({
					gameCode: "test-content-storage",
					playScope: "global",
					key: "test_content_storage_ordered_number",
					type: "ordered-number",
					data: [
						{
							playerId: "3456",
							value: 42.3,
						},
						{
							playerId: "2345",
							value: 15,
						},
						{
							playerId: "1234",
							value: 0.5,
						},
					],
				});
			});

			it("can read - rank", async () => {
				const result = await contentStorageService.read({
					gameCode: "test-content-storage",
					key: "test_content_storage_ordered_number",
					type: "ordered-number",
					rankOfPlayerId: "3456",
				});

				expect(result).toEqual({
					gameCode: "test-content-storage",
					playScope: "global",
					key: "test_content_storage_ordered_number",
					type: "ordered-number",
					data: [
						{
							playerId: "3456",
							value: 2,
						},
					],
				});
			});
		});
	});

	describe("abnormal case", () => {
		describe("write - error", () => {
			it("req is empty.", async () => {
				try {
					await contentStorageService.write(null as any);
				} catch (error) {
					expect(error).toBeInstanceOf(TypeError);
					expect((error as TypeError).message).toBe("req is empty.");
				}
			});
		});

		describe("read - error", () => {
			it("req is empty.", async () => {
				try {
					await contentStorageService.read(null as any);
				} catch (error) {
					expect(error).toBeInstanceOf(TypeError);
					expect((error as TypeError).message).toBe("req is empty.");
				}
			});
		});

		describe("read - nothing", () => {
			it("ValueType is general", async () => {
				jest.spyOn(contentStorageRedisClient, "mget").mockResolvedValue([]);
				const result = await contentStorageService.read({
					gameCode: "test-content-storage",
					key: "test_content_storage_general",
					type: "general",
					playerIds: [],
				});

				expect(result).toEqual({
					gameCode: "test-content-storage",
					playScope: "global",
					key: "test_content_storage_general",
					type: "general",
					data: [],
				});
			});

			it("ValueType is ordered-number", async () => {
				jest.spyOn(contentStorageRedisClient, "zrange").mockResolvedValue([]);
				const result = await contentStorageService.read({
					gameCode: "test-content-storage",
					key: "test_content_storage_ordered_number",
					type: "ordered-number",
					order: "desc",
				});

				expect(result).toEqual({
					gameCode: "test-content-storage",
					playScope: "global",
					key: "test_content_storage_ordered_number",
					type: "ordered-number",
					data: [],
				});
			});

			it("ValueType is ordered-number - rank", async () => {
				const result = await contentStorageService.read({
					gameCode: "test-content-storage",
					key: "test_content_storage_ordered_number",
					type: "ordered-number",
					rankOfPlayerId: "noPlayer",
				});

				expect(result).toEqual({
					gameCode: "test-content-storage",
					playScope: "global",
					key: "test_content_storage_ordered_number",
					type: "ordered-number",
					data: [
						{
							playerId: "noPlayer",
							value: null,
						},
					],
				});
			});
		});
	});
});
