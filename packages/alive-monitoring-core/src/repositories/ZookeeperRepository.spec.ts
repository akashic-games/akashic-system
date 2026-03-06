import { ZookeeperRepository } from "./ZookeeperRepository";
import { ZookeeperDataSource } from "../entities/ZookeeperDataSource";
import * as ZookeeperUtil from "./ZookeeperUtil";
import { Stat, Client } from "node-zookeeper-client";

describe("ZookeeperRepository", () => {
	const zookeeperDataSource = {
		hosts: [{ host: "localhost", port: 2181 }],
		option: { timeout: 10000, retries: 3 },
	} as ZookeeperDataSource;

	let repository: ZookeeperRepository;
	let dummyClient: Client;

	jest.spyOn(ZookeeperUtil, "resolveClient").mockImplementation(async () => {
		return dummyClient;
	});

	beforeEach(() => {
		repository = new ZookeeperRepository(zookeeperDataSource);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe("connect", () => {
		beforeEach(() => {
			dummyClient = {} as unknown as Client; // Mocking the Client type
		});

		it("should connect to the Zookeeper server", async () => {
			await expect(repository.connect()).resolves.toBeUndefined();
			expect(repository.connected()).toBe(true);
		});

		it("should not reconnect if already connected", async () => {
			await repository.connect();
			const initialClient = repository._client;
			await expect(repository.connect()).resolves.toBeUndefined();
			expect(repository._client).toBe(initialClient);
		});
	});

	describe("disconnect", () => {
		beforeEach(() => {
			dummyClient = {
				close: jest.fn(),
			} as unknown as Client; // Mocking the Client type
		});

		it("should disconnect the client if connected", async () => {
			await repository.connect();
			expect(repository.connected()).toBe(true);
			repository.disconnect();
			expect(repository.connected()).toBe(false);
			expect(repository._client).toBeUndefined();
		});

		it("should do nothing if not connected", () => {
			expect(() => repository.disconnect()).not.toThrow();
			expect(repository.connected()).toBe(false);
		});
	});

	describe("connected", () => {
		it("should return false if not connected", () => {
			expect(repository.connected()).toBe(false);
		});

		it("should return true if connected", async () => {
			await repository.connect();
			expect(repository.connected()).toBe(true);
		});
	});

	describe("createData", () => {
		beforeEach(() => {
			dummyClient = {
				create: jest.fn((path, _data, mode, callback) => callback(null, path + "/" + mode.toString() + "/created")),
				mkdirp: jest.fn((_path, callback) => callback(null)),
			} as unknown as Client; // Mocking the Client type
		});

		it("should create data with a valid path and data", async () => {
			const path = "/test/path";
			const data = Buffer.from("test data");
			const result = await repository.createData(path, data);
			expect(result).toBe(path + "/0/created");
		});

		it("should create ephemeral data if specified", async () => {
			const path = "/test/ephemeral";
			const data = Buffer.from("ephemeral data");
			const result = await repository.createData(path, data, { isEphemeral: true });
			expect(result).toBe(path + "/1/created");
		});

		it("should create parent nodes if specified", async () => {
			const path = "/test/parent/nodes";
			const data = Buffer.from("parent nodes data");
			const result = await repository.createData(path, data, { madeParent: true });
			expect(result).toBe(path + "/0/created");
		});
	});

	describe("createParentNode", () => {
		beforeEach(() => {
			dummyClient = {
				mkdirp: jest.fn((_path, callback) => callback(null)),
			} as unknown as Client; // Mocking the Client type
		});

		it("should create parent nodes for a given path", async () => {
			const path = "/test/parent/nodes";
			await expect(repository.createParentNode(path)).resolves.toBeUndefined();
		});
	});

	describe("delete", () => {
		beforeEach(() => {
			dummyClient = {
				remove: jest.fn((_path, _version, callback) => callback(null)),
			} as unknown as Client; // Mocking the Client type
		});

		it("should delete a node with a valid path", async () => {
			const path = "/test/delete/node";
			await expect(repository.delete(path)).resolves.toBeUndefined();
		});

		it("should delete a node with a specific version", async () => {
			const path = "/test/delete/versioned/node";
			const version = 1;
			await expect(repository.delete(path, version)).resolves.toBeUndefined();
		});
	});

	describe("stat", () => {
		const dummyStat = {
			czxid: Buffer.from("czxid"),
			version: -1,
		} as Stat; // Mocking the Stat type

		beforeEach(() => {
			dummyClient = {
				exists: jest.fn((path, callback) => {
					if (path === "/test/nonexistent/node") {
						callback(null, null);
					} else {
						callback(null, dummyStat);
					}
				}),
			} as unknown as Client; // Mocking the Client type
		});

		it("should return the stat of a node with a valid path", async () => {
			const path = "/test/stat/node";
			const stat = await repository.stat(path);
			expect(stat).toBeDefined();
			// Stat は interface なので、czxid などのプロパティが存在することを確認
			expect(stat).toHaveProperty("czxid");
		});

		it("should return null if the node does not exist", async () => {
			const path = "/test/nonexistent/node";
			const stat = await repository.stat(path);
			expect(stat).toBeNull();
		});
	});

	describe("exists", () => {
		const dummyStat = {
			czxid: Buffer.from("czxid"),
			version: -1,
		} as Stat; // Mocking the Stat type

		beforeEach(() => {
			dummyClient = {
				exists: jest.fn((path, callback) => {
					if (path === "/test/nonexistent/node") {
						callback(null, null);
					} else {
						callback(null, dummyStat);
					}
				}),
			} as unknown as Client; // Mocking the Client type
		});

		it("should return true if the node exists", async () => {
			const path = "/test/existing/node";
			const exists = await repository.exists(path);
			expect(exists).toBe(true);
		});

		it("should return false if the node does not exist", async () => {
			const path = "/test/nonexistent/node";
			const exists = await repository.exists(path);
			expect(exists).toBe(false);
		});
	});

	describe("setData", () => {
		const dummyStat = {
			czxid: Buffer.from("czxid"),
			version: -1,
		} as Stat; // Mocking the Stat type

		beforeEach(() => {
			dummyClient = {
				setData: jest.fn((_path, _data, version, callback) => {
					const stat = dummyStat;
					stat.version = version ?? -1;
					callback(null, stat);
				}),
			} as unknown as Client; // Mocking the Client type
		});

		it("should set data for a node with a valid path", async () => {
			const path = "/test/set/data/node";
			const data = Buffer.from("new data");
			const stat = await repository.setData(path, data);
			expect(stat).toBeDefined();
			expect(stat).toHaveProperty("version");
			expect(stat.version).toBe(-1); // 初期状態ではバージョンは -1
		});

		it("should set data with a specific version", async () => {
			const path = "/test/set/versioned/data/node";
			const data = Buffer.from("versioned data");
			const version = 1;
			const stat = await repository.setData(path, data, version);
			expect(stat).toBeDefined();
			expect(stat).toHaveProperty("version");
			expect(stat.version).toBe(version);
		});
	});

	describe("getChildren", () => {
		beforeEach(() => {
			dummyClient = {
				getChildren: jest.fn((path, callback) => {
					if (path === "/test/no/children/node") {
						callback(null, []);
					} else {
						callback(null, ["child1", "child2"]);
					}
				}),
			} as unknown as Client; // Mocking the Client type
		});

		it("should return children of a node with a valid path", async () => {
			const path = "/test/children/node";
			const children = await repository.getChildren(path);
			expect(children).toBeDefined();
			expect(children).toEqual(["child1", "child2"]);
		});

		it("should return an empty array if the node has no children", async () => {
			const path = "/test/no/children/node";
			const children = await repository.getChildren(path);
			expect(children).toEqual([]);
		});
	});

	describe("getData", () => {
		beforeEach(() => {
			dummyClient = {
				getData: jest.fn((path, callback) => {
					if (path === "/test/nonexistent/data/node") {
						callback(new Error("data is not exist"), null);
					} else {
						callback(null, Buffer.from('{"data": "test data"}'));
					}
				}),
			} as unknown as Client; // Mocking the Client type
		});

		it("should return data for a node with a valid path", async () => {
			const path = "/test/get/data/node";
			const data = await repository.getData(path);
			expect(data).toBeDefined();
			expect(data.toString()).toBe('{"data": "test data"}'); // Mocked data
		});

		it("should throw error if the node does not exist", async () => {
			const path = "/test/nonexistent/data/node";
			await expect(repository.getData(path)).rejects.toThrow("data is not exist");
		});
	});

	describe("getJson", () => {
		beforeEach(() => {
			dummyClient = {
				getData: jest.fn((path, callback) => {
					if (path === "/test/nonexistent/data/node") {
						callback(new Error("data is not exist"), null);
					} else {
						callback(null, Buffer.from('{"data": "test data"}'));
					}
				}),
			} as unknown as Client; // Mocking the Client type
		});

		it("should return JSON data for a node with a valid path", async () => {
			const path = "/test/get/data/node";
			const jsonData = await repository.getJson(path);
			expect(jsonData).toBeDefined();
			expect(jsonData).toEqual({ data: "test data" }); // Mocked JSON data
		});

		it("should throw error if the node does not exist", async () => {
			const path = "/test/nonexistent/data/node";
			await expect(repository.getJson(path)).rejects.toThrow("data is not exist");
		});
	});

	describe("getObject", () => {
		class DummyData {
			data: string;
			constructor(data: string) {
				this.data = data;
			}
		}

		function instantiateDummyData(json: { data: string }): DummyData {
			return new DummyData(json.data);
		}

		beforeEach(() => {
			dummyClient = {
				getData: jest.fn((path, callback) => {
					if (path === "/test/nonexistent/data/node") {
						callback(new Error("data is not exist"), null);
					} else {
						callback(null, Buffer.from('{"data": "test data"}'));
					}
				}),
			} as unknown as Client; // Mocking the Client type
		});

		it("should return an object for a node with a valid path", async () => {
			const path = "/test/get/object/node";
			const objectData = await repository.getObject(path, instantiateDummyData);
			expect(objectData).toBeDefined();
			expect(objectData).toBeInstanceOf(DummyData);
		});

		it("should throw error if the node does not exist", async () => {
			const path = "/test/nonexistent/data/node";
			await expect(repository.getObject(path, instantiateDummyData)).rejects.toThrow("data is not exist");
		});
	});
});
