import * as dt from "@akashic/server-engine-data-types";
import config from "config";
import * as ac from "../";

describe("ExcludedProcess", () => {
	const loader = new ac.DatabaseConfigLoader(config);
	const conf = loader.load("dbSettings.database");

	const process0 = new dt.ProcessIdentity({
		fqdn: new dt.Fqdn("host0.domain.jp"),
		type: dt.Constants.TYPE_GAME_RUNNER_2,
		name: "0",
	});
	const process1 = new dt.ProcessIdentity({
		fqdn: new dt.Fqdn("host1.domain.jp"),
		type: dt.Constants.TYPE_GAME_RUNNER_2,
		name: "1",
	});
	const process2 = new dt.ProcessIdentity({
		fqdn: new dt.Fqdn("host2.domain.jp"),
		type: dt.Constants.TYPE_GAME_RUNNER_2,
		name: "2",
	});

	function clear() {
		return ac.Database.createConnection(conf).then((db) => {
			return db
				.transaction((connection) => connection.execute("DELETE FROM excludedProcesses"))
				.then(() => db.end())
				.then();
		});
	}

	beforeEach(() => {
		return clear();
	});

	afterEach(() => {
		return clear();
	});

	it("can save/get processes", () => {
		return ac.Database.createConnection(conf).then((db) => {
			return db
				.transaction((connection) => {
					const repo = db.repositories.excludedProcess;
					return repo
						.getAll(connection)
						.then((identities) => {
							expect(identities.length).toEqual(0);
						})
						.then(() => repo.save(process0, connection))
						.then((identity) => {
							expect(identity.fqdn.value).toEqual(process0.fqdn.value);
							expect(identity.type).toEqual(process0.type);
							expect(identity.name).toEqual(process0.name);
						})
						.then(() => repo.getAll(connection))
						.then((identities) => {
							expect(identities.length).toEqual(1);
							expect(identities[0].fqdn.value).toEqual(process0.fqdn.value);
							expect(identities[0].type).toEqual(process0.type);
							expect(identities[0].name).toEqual(process0.name);
						})
						.then(() => repo.save(process1, connection))
						.then((identity) => {
							expect(identity.fqdn.value).toEqual(process1.fqdn.value);
							expect(identity.type).toEqual(process1.type);
							expect(identity.name).toEqual(process1.name);
						})
						.then(() => repo.getAll(connection))
						.then((identities) => {
							expect(identities.length).toEqual(2);
						})
						.then(() => repo.get(process0, connection))
						.then((identity) => {
							expect(identity.fqdn.value).toEqual(process0.fqdn.value);
							expect(identity.type).toEqual(process0.type);
							expect(identity.name).toEqual(process0.name);
						})
						.then(() => repo.get(process1, connection))
						.then((identity) => {
							expect(identity.fqdn.value).toEqual(process1.fqdn.value);
							expect(identity.type).toEqual(process1.type);
							expect(identity.name).toEqual(process1.name);
						})
						.then(() => repo.get(process2, connection))
						.then((identity) => {
							expect(identity).toBeFalsy();
						});
				})
				.then(() => db.end());
		});
	});

	it("can remove process", () => {
		return ac.Database.createConnection(conf).then((db) => {
			return db
				.transaction((connection) => {
					const repo = db.repositories.excludedProcess;
					return repo
						.getAll(connection)
						.then((identities) => {
							expect(identities.length).toEqual(0);
						})
						.then(() => repo.save(process0, connection))
						.then(() => repo.save(process1, connection))
						.then(() => repo.save(process2, connection))
						.then(() => repo.getAll(connection))
						.then((identities) => {
							expect(identities.length).toEqual(3);
						})
						.then(() => repo.remove(process0, connection))
						.then(() => repo.remove(process2, connection))
						.then(() => repo.getAll(connection))
						.then((identities) => {
							expect(identities.length).toEqual(1);
							expect(identities[0].fqdn.value).toEqual(process1.fqdn.value);
							expect(identities[0].type).toEqual(process1.type);
							expect(identities[0].name).toEqual(process1.name);
						});
				})
				.then(() => db.end());
		});
	});
});
