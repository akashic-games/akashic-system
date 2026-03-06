import * as ServerEngineDataTypes from "@akashic/server-engine-data-types";
import config from "config";
import * as AkashicActiveRecord from "../";
import * as ClusterIdentityMapper from "../repositories/mappers/ClusterIdentityMapper";

describe("processes", () => {
	const loader = new AkashicActiveRecord.DatabaseConfigLoader(config);
	const conf = loader.load("dbSettings.database");

	const process0 = new ServerEngineDataTypes.Process({
		clusterIdentity: ClusterIdentityMapper.recordToEntity({
			reverseFqdn: "jp.domain.host0",
			type: ServerEngineDataTypes.Constants.TYPE_GAME_RUNNER_2,
			name: "0",
			czxid: "202029609",
		}),
		port: 12000,
		machineValues: { capacity: 32, videoEnabled: true },
	});
	const process1 = new ServerEngineDataTypes.Process({
		clusterIdentity: ClusterIdentityMapper.recordToEntity({
			reverseFqdn: "jp.domain.host1",
			type: ServerEngineDataTypes.Constants.TYPE_GAME_RUNNER_2,
			name: "1",
			czxid: "202029610",
		}),
		port: 12000,
		machineValues: { capacity: 32, videoEnabled: true },
	});
	function clear() {
		return AkashicActiveRecord.Database.createConnection(conf).then((db) => {
			return db
				.transaction((connection) => connection.execute("DELETE FROM processes"))
				.then(() => db.end())
				.then();
		});
	}

	beforeEach(async () => {
		return clear();
	});

	afterEach(() => {
		return clear();
	});

	it("can save/get processes", async () => {
		const db = await AkashicActiveRecord.Database.createConnection(conf);

		await db.transaction(async (connection) => {
			const repo = db.repositories.process;
			// 空の状態で取得
			let identities = await repo.getAll(connection);
			expect(identities.length).toEqual(0);

			// processを1つ挿入
			const identity = await repo.saveOrUpdate(process0, connection);
			expect(identity.clusterIdentity.fqdn).toEqual(process0.clusterIdentity.fqdn);
			expect(identity.clusterIdentity.type).toEqual(process0.clusterIdentity.type);
			expect(identity.clusterIdentity.name).toEqual(process0.clusterIdentity.name);

			// 挿入したプロセスが期待されたものであるか取得して確認
			identities = await repo.getAll(connection);
			expect(identities.length).toEqual(1);
			expect(identities[0].clusterIdentity.fqdn).toEqual(process0.clusterIdentity.fqdn);
			expect(identities[0].clusterIdentity.type).toEqual(process0.clusterIdentity.type);
			expect(identities[0].clusterIdentity.name).toEqual(process0.clusterIdentity.name);
		});
		await db.end();
	});

	it("can get fqdn", async () => {
		const db = await AkashicActiveRecord.Database.createConnection(conf);

		await db.transaction(async (connection) => {
			const repo = db.repositories.process;

			// 空の状態でFQDNを取得
			let identities = await repo.getFqdn(connection);
			expect(identities.length).toEqual(0);

			// 異なるFQDNのprocessを2つ挿入
			await repo.saveOrUpdate(process0, connection);
			await repo.saveOrUpdate(process1, connection);

			// 挿入されたプロセスからFQDNを取得
			identities = await repo.getFqdn(connection);
			expect(identities.length).toEqual(2);
			expect(identities[0]).toEqual(process0.clusterIdentity.fqdn);
			expect(identities[1]).toEqual(process1.clusterIdentity.fqdn);
		});

		await db.end();
	});
});
