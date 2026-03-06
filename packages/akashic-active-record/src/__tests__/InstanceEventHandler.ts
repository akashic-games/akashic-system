import * as dt from "@akashic/server-engine-data-types";
import * as tapper from "@akashic/tapper";
import config from "config";
import * as ac from "../";

const loader = new ac.DatabaseConfigLoader(config);
const conf = loader.load("dbSettings.database");

describe("InstanceEventHandler", () => {
	// specで作成したデータの削除をする
	function deleteEventHandlerByProtocol(protocol: string, connection: tapper.Connection): Promise<any> {
		return connection.execute("DELETE FROM eventHandlers WHERE protocol =?", protocol);
	}
	function deleteInstanceEventHandler(instanceId: string, connection: tapper.Connection): Promise<any> {
		return connection.execute("DELETE FROM instanceEventHandlers WHERE instanceId =?", instanceId);
	}

	const insertEventHandler = dt.EventHandler.fromObject({
		type: "spec-test-handler",
		endpoint: "http://spec.com",
		protocol: "spec-ping",
	});
	const instanceId = "123456789";

	it("save", (cb) => {
		ac.Database.createConnection(conf)
			.then((db) =>
				db
					.transaction((connection) => {
						const repo = db.repositories.instanceEventHandler;
						return repo
							.save(insertEventHandler, instanceId, connection)
							.then((record) => {
								expect(record.id).not.toBeNull();
								expect(record.type).toEqual(insertEventHandler.type);
								expect(record.endpoint).toEqual(insertEventHandler.endpoint);
								expect(record.protocol).toEqual(insertEventHandler.protocol);
							})
							.then(() => {
								return Promise.all([
									deleteEventHandlerByProtocol(insertEventHandler.protocol, connection),
									deleteInstanceEventHandler(instanceId, connection),
								]);
							});
					})
					.then(() => {
						db.end();
					}),
			)
			.then(cb)
			.catch((err) => {
				console.log("save error", err);
				cb.fail(err);
			});
	});

	it("getByInstanceId", (cb) => {
		ac.Database.createConnection(conf)
			.then((db) =>
				db
					.transaction((connection) => {
						const repo = db.repositories.instanceEventHandler;
						return repo.save(insertEventHandler, instanceId, connection);
					})
					.then((_handler) => {
						const repo = db.repositories.instanceEventHandler;
						return repo.getByInstanceId(instanceId).then((record) => {
							expect(record.length).toBeGreaterThan(0);
							expect(record[0].id).not.toBeNull();
							expect(record[0].type).toEqual(insertEventHandler.type);
							expect(record[0].endpoint).toEqual(insertEventHandler.endpoint);
							expect(record[0].protocol).toEqual(insertEventHandler.protocol);
						});
					})
					.then(() => {
						db.transaction((connection) => {
							return Promise.all([
								deleteEventHandlerByProtocol(insertEventHandler.protocol, connection),
								deleteInstanceEventHandler(instanceId, connection),
							]);
						}).then(() => {
							db.end();
						});
					}),
			)
			.then(cb)
			.catch((err) => {
				console.log("getByInstanceId error", err);
				cb.fail(err);
			});
	});

	it("remove", (cb) => {
		ac.Database.createConnection(conf)
			.then((db) =>
				db
					.transaction((connection) => {
						const repo = db.repositories.instanceEventHandler;
						return repo.save(insertEventHandler, instanceId, connection);
					})
					.then((handler) => {
						const repo = db.repositories.instanceEventHandler;
						return repo.remove(handler.id).then((record) => {
							expect(record).toBeUndefined();
						});
					})
					.then(() => {
						const repo = db.repositories.instanceEventHandler;
						return repo.getByInstanceId(instanceId).then((records) => {
							expect(records.length).toEqual(0);
						});
					})
					.then(() => {
						db.end();
					}),
			)
			.then(cb)
			.catch((err) => {
				console.log("remove error", err);
				cb.fail(err);
			});
	});
});
