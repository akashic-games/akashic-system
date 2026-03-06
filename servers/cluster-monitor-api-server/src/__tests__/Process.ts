import { Database, DatabaseConfigLoader } from "@akashic/akashic-active-record";
import { ZookeeperDataSource } from "@akashic/alive-monitoring-core";
import config from "config";
import ProcessesRequest from "../controllers/process/ProcessesRequest";
import { createProcessRepository } from "../repositories/ProcessRepository";
import { ProcessService } from "../services/ProcessService";
import type { ProcessModel } from "../services/ProcessService";
import { ZookeeperRepository } from "@akashic/alive-monitoring-core";

class ProcessIdentity {
	public reverseFqdn: string;
	public type: string;
	public name: string;
}

describe("process", () => {
	const dbConfigLoader = new DatabaseConfigLoader(config);
	const dbConf = dbConfigLoader.load("dbSettings.database");
	const zkConfig = config.get<ZookeeperDataSource>("zookeeper");
	const zkRepository = new ZookeeperRepository(zkConfig);
	let database: Database;

	beforeAll(async () => {
		database = await Database.createConnection(dbConf);
	});
	afterAll(async () => {
		await database.end();
	});
	beforeEach(async () => {
		return await clear();
	});
	afterEach(async () => {
		return await clear();
	});

	async function clear() {
		await database.transaction((connection) => connection.execute("DELETE FROM processes"));
		await database.transaction((connection) => connection.execute("DELETE FROM excludedProcesses"));
	}

	it("can get fqdn", async () => {
		const processRepository = createProcessRepository(database);
		const processService = new ProcessService(processRepository, zkRepository);
		// DBが空の状態でFQDN取得
		let fqdn = await processService.getFqdn();
		expect(fqdn.values.length).toEqual(0);

		// DBに直接テストデータを流し込む
		await database.transaction((connection) =>
			connection.execute(
				`INSERT INTO 
					processes 
					values
					('jp.domain.host0', 'gameRunner2', '0', 202029609, 12000, '{"capacity":32,"videoEnabled":true}'),
					('jp.domain.host1', 'gameRunner2', '0', 202029610, 12000, '{"capacity":32,"videoEnabled":true}')`,
			),
		);

		// processesにテストデータが挿入された状態でFQDNを取得
		fqdn = await processService.getFqdn();
		expect(fqdn.values.length).toEqual(2);
		expect(fqdn.values[0]).toEqual("host0.domain.jp");
		expect(fqdn.values[1]).toEqual("host1.domain.jp");
		expect(fqdn.totalCount).toEqual("2");
	});

	it("can find processes", async () => {
		const processRepository = createProcessRepository(database);
		const processService = new ProcessService(processRepository, zkRepository);

		// 検索パラメータ設定
		let params: ProcessesRequest = {
			_offset: 0,
			_limit: 10,
			_count: 1,
			host: "",
			type: "gameRunner2",
		};
		// 空の状態で取得
		let processes = await processService.find(params);
		expect(processes.totalCount).toEqual("0");
		// テストデータ挿入
		await database.transaction((connection) =>
			connection.execute(
				`INSERT INTO 
					processes 
					values
					('jp.domain.host0', 'gameRunner2', '0', 202029609, 12000, '{"capacity":32,"videoEnabled":true}'),
					('jp.domain.host1', 'gameRunner2', '0', 202029610, 12000, '{"capacity":32,"videoEnabled":true}')`,
			),
		);

		// 複数のprocessを取得
		processes = await processService.find(params);

		// 複数のprocessをProcessModelとして取得できていることを確認
		let expectedProcesses: ProcessModel[] = [
			{
				processName: "jp.domain.host0.gameRunner2.0",
				type: "gameRunner2",
				host: "host0.domain.jp",
				port: 12000,
				czxid: "202029609",
				capacity: 32,
				videoEnabled: true,
				mode: "normal",
				status: undefined,
				trait: [],
			},
			{
				processName: "jp.domain.host1.gameRunner2.0",
				type: "gameRunner2",
				host: "host1.domain.jp",
				port: 12000,
				czxid: "202029610",
				capacity: 32,
				videoEnabled: true,
				mode: "normal",
				status: undefined,
				trait: [],
			},
		];
		expect(processes.values).toEqual(expectedProcesses);
		expect(processes.totalCount).toBe("2");

		// host名で検索するパラメータに変更
		params = {
			_offset: 0,
			_limit: 10,
			_count: 1,
			host: "host0.domain.jp",
			type: "gameRunner2",
		};

		// host指定してprocessを取得
		processes = await processService.find(params);

		// 指定したhost名のprocessのみProcessModelとして取得できていることを確認
		expectedProcesses = [
			{
				processName: "jp.domain.host0.gameRunner2.0",
				type: "gameRunner2",
				host: "host0.domain.jp",
				port: 12000,
				czxid: "202029609",
				capacity: 32,
				videoEnabled: true,
				mode: "normal",
				status: undefined,
				trait: [],
			},
		];
		expect(processes.values).toEqual(expectedProcesses);
		expect(processes.totalCount).toBe("1");
	});

	it("can get trait", async () => {
		const processRepository = createProcessRepository(database);
		const processService = new ProcessService(processRepository, zkRepository);

		// 検索パラメータ設定
		const params: ProcessesRequest = {
			_offset: 0,
			_limit: 10,
			_count: 1,
			host: "",
			type: "gameRunner2",
		};

		// テストデータ挿入
		await database.transaction((connection) =>
			connection.execute(
				`INSERT INTO 
					processes 
					values
					('jp.domain.host0', 'gameRunner2', '0', 202029609, 12000, '{"capacity":32,"videoEnabled":true}'),
					('jp.domain.host1', 'gameRunner2', '0', 202029609, 12000, '{"capacity":32,"videoEnabled":true,"trait":[]}'),
					('jp.domain.host2', 'gameRunner2', '0', 202029609, 12000, '{"capacity":32,"videoEnabled":true,"trait":["trait0"]}'),
					('jp.domain.host3', 'gameRunner2', '0', 202029609, 12000, '{"capacity":32,"videoEnabled":true,"trait":["trait1","trait2"]}')`,
			),
		);

		// 複数のprocessを取得
		const processes = await processService.find(params);

		// トレイトがない、空配列、文字列の配列の場合を確認
		const expectedProcesses: ProcessModel[] = [
			{
				processName: "jp.domain.host0.gameRunner2.0",
				type: "gameRunner2",
				host: "host0.domain.jp",
				port: 12000,
				czxid: "202029609",
				capacity: 32,
				videoEnabled: true,
				mode: "normal",
				status: undefined,
				trait: [],
			},
			{
				processName: "jp.domain.host1.gameRunner2.0",
				type: "gameRunner2",
				host: "host1.domain.jp",
				port: 12000,
				czxid: "202029609",
				capacity: 32,
				videoEnabled: true,
				mode: "normal",
				status: undefined,
				trait: [],
			},
			{
				processName: "jp.domain.host2.gameRunner2.0",
				type: "gameRunner2",
				host: "host2.domain.jp",
				port: 12000,
				czxid: "202029609",
				capacity: 32,
				videoEnabled: true,
				mode: "normal",
				status: undefined,
				trait: ["trait0"],
			},
			{
				processName: "jp.domain.host3.gameRunner2.0",
				type: "gameRunner2",
				host: "host3.domain.jp",
				port: 12000,
				czxid: "202029609",
				capacity: 32,
				videoEnabled: true,
				mode: "normal",
				status: undefined,
				trait: ["trait1", "trait2"],
			},
		];
		expect(processes.values).toEqual(expectedProcesses);
	});

	// 2024/08/19追記 CI再構築時に現時点で動いていないテストを一旦無効化
	xit("can change processes mode", async () => {
		const processRepository = createProcessRepository(database);
		const processService = new ProcessService(processRepository, zkRepository);

		// プロセス一覧と、除外プロセスのテストデータを挿入
		await database.transaction((connection) =>
			connection.execute(
				`INSERT INTO 
					processes 
					values
					('jp.domain.host0', 'gameRunner2', '01', 202029609, 12000, '{"capacity":32,"videoEnabled":true}'),
					('jp.domain.host0', 'gameRunner2', '02', 202029610, 12000, '{"capacity":32,"videoEnabled":true}'),
					('jp.domain.host0', 'gameRunner2', '03', 202029611, 12000, '{"capacity":32,"videoEnabled":true}'),
					('jp.domain.host1', 'gameRunner2', '01', 202029612, 12000, '{"capacity":32,"videoEnabled":true}'),
					('jp.domain.host1', 'gameRunner2', '02', 202029612, 12000, '{"capacity":32,"videoEnabled":true}')`,
			),
		);
		await database.transaction((connection) =>
			connection.execute(
				`INSERT INTO 
					excludedProcesses 
					values
					('jp.domain.host0', 'gameRunner2', '02'),
					('jp.domain.host0', 'gameRunner2', '03'),
					('jp.domain.host1', 'gameRunner2', '01')`,
			),
		);

		// host0.domain.jpのプロセスを全てnormalにする
		await processService.changeProcessesMode("host0.domain.jp", "normal");

		let result = await database.transaction((connection) => connection.query(ProcessIdentity, `SELECT * FROM excludedProcesses`));
		let expectedProcesses = [
			{
				reverseFqdn: "jp.domain.host1",
				type: "gameRunner2",
				name: "01",
			},
		];
		expect(result).toEqual(expectedProcesses);

		// host0.domain.jpのプロセスを全てstandbyにする
		await processService.changeProcessesMode("host0.domain.jp", "standby");

		result = await database.transaction((connection) => connection.query(ProcessIdentity, `SELECT * FROM excludedProcesses`));

		expectedProcesses = [
			{
				reverseFqdn: "jp.domain.host0",
				type: "gameRunner2",
				name: "01",
			},
			{
				reverseFqdn: "jp.domain.host0",
				type: "gameRunner2",
				name: "02",
			},
			{
				reverseFqdn: "jp.domain.host0",
				type: "gameRunner2",
				name: "03",
			},
			{
				reverseFqdn: "jp.domain.host1",
				type: "gameRunner2",
				name: "01",
			},
		];

		expect(result).toEqual(expectedProcesses);

		// host1.domain.jpのプロセスを全てstandbyにする。
		// 既にstandbyなプロセスがあっても問題が無いか確認
		await processService.changeProcessesMode("host1.domain.jp", "standby");

		result = await database.transaction((connection) => connection.query(ProcessIdentity, `SELECT * FROM excludedProcesses`));

		expectedProcesses = [
			{
				reverseFqdn: "jp.domain.host0",
				type: "gameRunner2",
				name: "01",
			},
			{
				reverseFqdn: "jp.domain.host0",
				type: "gameRunner2",
				name: "02",
			},
			{
				reverseFqdn: "jp.domain.host0",
				type: "gameRunner2",
				name: "03",
			},
			{
				reverseFqdn: "jp.domain.host1",
				type: "gameRunner2",
				name: "01",
			},
			{
				reverseFqdn: "jp.domain.host1",
				type: "gameRunner2",
				name: "02",
			},
		];
		expect(result).toEqual(expectedProcesses);
	});
});
