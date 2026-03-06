import * as dt from "@akashic/server-engine-data-types";
import { Connection } from "@akashic/tapper";
import * as tapper from "@akashic/tapper";
import config from "config";
import * as ac from "../";
import * as factory from "../Factory";

describe("Instance", () => {
	const conf = config.get<ac.DatabaseConfig>("dbSettings.database");

	// specで作成したデータの削除をする
	function instanceDelete(instanceId: string, connection: tapper.Connection): Promise<any> {
		return connection.execute("DELETE FROM instances WHERE id =?", instanceId);
	}
	function deleteVideoSetting(instanceId: string, connection: tapper.Connection): Promise<any> {
		return connection.execute("DELETE FROM videoSettings WHERE instanceId =?", instanceId);
	}

	const gameCode: string = "ncg456";

	function getTest(cb: any, name: string, get: (repo: ac.Instance, id: string, connection?: Connection) => Promise<dt.Instance>) {
		let savedRecord: dt.Instance = null;
		ac.Database.createConnection(conf)
			.then((db) =>
				db
					.transaction((connection) => {
						const status = "prepare";
						const repo = db.repositories.instance;
						const instance = factory.createInstance(gameCode, status);
						return repo.save(instance, connection).then((record) => {
							savedRecord = record;
							expect(record.gameCode).toEqual(gameCode);
							expect(record.status).toEqual(status);
						});
					})
					.then(() => {
						return db
							.transaction((connection) => get(db.repositories.instance, savedRecord.id, connection))
							.then((record) => {
								expect(record).toEqual(savedRecord);
							});
					})
					.then(() => {
						return db
							.transaction((connection) => {
								return instanceDelete(savedRecord.id, connection);
							})
							.then(() => {
								db.end();
							});
					}),
			)
			.then(cb)
			.catch((err) => {
				console.log(name + " error", err);
				cb.fail(err);
			});
	}

	it("get", (cb) => {
		getTest(cb, "get", (repo, id, connection) => repo.get(id, connection));
	});

	it("getWithLock", (cb) => {
		getTest(cb, "getWithLock", (repo, id, connection) => repo.getWithLock(id, connection));
	});

	it("getByPlayId", (cb) => {
		let playId: string = null;
		let instanceId: string = null;
		let playRepos: ac.Play = null;
		let instanceRepos: ac.Instance = null;
		let playsInstancesRepos: ac.PlaysInstances = null;
		const status = "prepare";
		ac.Database.createConnection(conf)
			.then((db) =>
				db
					.transaction((connection) => {
						playRepos = db.repositories.play;
						instanceRepos = db.repositories.instance;
						playsInstancesRepos = db.repositories.playsInstances;
						return instanceRepos
							.save(factory.createInstance(gameCode, status), connection)
							.then((instance) => {
								instanceId = instance.id;
								return playRepos.save(factory.createPlay(gameCode, status));
							})
							.then((play) => {
								playId = play.id;
								return playsInstancesRepos.save(playId, instanceId);
							});
					})
					.then(() => playsInstancesRepos.getByPlayId(playId))
					.then((instances) => {
						expect(instances.length).toEqual(1);
					})
					.then(() => {
						return db
							.transaction((connection) => {
								return instanceDelete(instanceId, connection);
							})
							.then(() => {
								db.end();
							});
					}),
			)
			.then(cb)
			.catch((err) => {
				console.log("getByPlayId error", err);
				cb.fail(err);
			});
	});

	it("updateStatus", (cb) => {
		let testInstanceId = "";
		ac.Database.createConnection(conf)
			.then((db) =>
				db
					.transaction((connection) => {
						const repo = db.repositories.instance;
						const instance = factory.createInstance(gameCode, "prepare");
						const newStatus = "running";
						return repo
							.save(instance, connection)
							.then((instance) => {
								testInstanceId = instance.id;
								return repo.updateStatus(instance.id, newStatus, undefined, undefined, connection);
							})
							.then((record) => {
								expect(record.gameCode).toEqual(gameCode);
								expect(record.status).toEqual(newStatus);
							});
					})
					.then(() => {
						return db
							.transaction((connection) => {
								return instanceDelete(testInstanceId, connection);
							})
							.then(() => {
								db.end();
							});
					}),
			)
			.then(cb)
			.catch((err) => {
				console.log("updateStatus error", err);
				cb.fail(err);
			});
	});

	it("updateStatus with exitCode", (cb) => {
		let testInstanceId = "";
		const exitCode = 100;
		ac.Database.createConnection(conf)
			.then((db) =>
				db
					.transaction((connection) => {
						const repo = db.repositories.instance;
						const instance = factory.createInstance(gameCode, "prepare");
						const newStatus = "error";
						return repo
							.save(instance, connection)
							.then((instance) => {
								testInstanceId = instance.id;
								return repo.updateStatus(instance.id, newStatus, exitCode, undefined, connection);
							})
							.then((record) => {
								expect(record.gameCode).toEqual(gameCode);
								expect(record.status).toEqual(newStatus);
								expect(record.exitCode).toEqual(exitCode);
							});
					})
					.then(() => {
						return db
							.transaction((connection) => {
								return instanceDelete(testInstanceId, connection);
							})
							.then(() => {
								db.end();
							});
					}),
			)
			.then(cb)
			.catch((err) => {
				console.log("updateStatus with exitCode error", err);
				cb.fail(err);
			});
	});

	it("updateStatus with processName", (cb) => {
		let testInstanceId = "";
		const processName = "process0";
		ac.Database.createConnection(conf)
			.then((db) =>
				db
					.transaction((connection) => {
						const repo = db.repositories.instance;
						const instance = factory.createInstance(gameCode, "prepare");
						const newStatus = "error";
						return repo
							.save(instance, connection)
							.then((instance) => {
								testInstanceId = instance.id;
								return repo.updateStatus(instance.id, newStatus, undefined, processName, connection);
							})
							.then((record) => {
								expect(record.gameCode).toEqual(gameCode);
								expect(record.status).toEqual(newStatus);
								expect(record.processName).toEqual(processName);
							});
					})
					.then(() => {
						return db
							.transaction((connection) => {
								return instanceDelete(testInstanceId, connection);
							})
							.then(() => {
								db.end();
							});
					}),
			)
			.then(cb)
			.catch((err) => {
				console.log("updateStatus with exitCode error", err);
				cb.fail(err);
			});
	});

	it("updateStatus with exitCode and processName", (cb) => {
		let testInstanceId = "";
		const exitCode = 200;
		const processName = "process1";
		ac.Database.createConnection(conf)
			.then((db) =>
				db
					.transaction((connection) => {
						const repo = db.repositories.instance;
						const instance = factory.createInstance(gameCode, "prepare");
						const newStatus = "error";
						return repo
							.save(instance, connection)
							.then((instance) => {
								testInstanceId = instance.id;
								return repo.updateStatus(instance.id, newStatus, exitCode, processName, connection);
							})
							.then((record) => {
								expect(record.gameCode).toEqual(gameCode);
								expect(record.status).toEqual(newStatus);
								expect(record.exitCode).toEqual(exitCode);
								expect(record.processName).toEqual(processName);
							});
					})
					.then(() => {
						return db
							.transaction((connection) => {
								return instanceDelete(testInstanceId, connection);
							})
							.then(() => {
								db.end();
							});
					}),
			)
			.then(cb)
			.catch((err) => {
				console.log("updateStatus with exitCode error", err);
				cb.fail(err);
			});
	});

	it("updateStatus with exitCode", (cb) => {
		let testInstanceId = "";
		ac.Database.createConnection(conf)
			.then((db) =>
				db
					.transaction((connection) => {
						const repo = db.repositories.instance;
						const instance = factory.createInstance(gameCode, "prepare");
						const newStatus = "error";
						return repo
							.save(instance, connection)
							.then((instance) => {
								testInstanceId = instance.id;
								return repo.updateStatus(instance.id, newStatus, 100, undefined, connection);
							})
							.then((record) => {
								expect(record.gameCode).toEqual(gameCode);
								expect(record.status).toEqual(newStatus);
							});
					})
					.then(() => {
						return db
							.transaction((connection) => {
								return instanceDelete(testInstanceId, connection);
							})
							.then(() => {
								db.end();
							});
					}),
			)
			.then(cb)
			.catch((err) => {
				console.log("updateStatus with exitCode error", err);
				cb.fail(err);
			});
	});

	it("findInstances", (cb) => {
		const videoSettingUrlList = ["setting1", "setting2", "setting1", "setting3", "setting1"];
		// cost > この値自体検索に関係ないので sort に使ってテストしやすいようにしてます、
		const generateParams: factory.CreateInstanceParams[] = [
			{
				gameCode: "game1",
				status: "prepare",
				cost: 1,
				processName: "process1",
				entryPoint: "hoge1",
			},
			{
				gameCode: "game2",
				status: "running",
				cost: 2,
				processName: "process1",
				entryPoint: "hoge1",
			},
			{
				gameCode: "game3",
				status: "running",
				cost: 3,
				processName: "process1",
				entryPoint: "hoge2",
			},
			{
				gameCode: "game2",
				status: "prepare",
				cost: 4,
				processName: "process2",
				entryPoint: "aws1",
			},
			{
				gameCode: "game1",
				status: "prepare",
				cost: 5,
				processName: "process2",
				entryPoint: "aws2",
			},
		];

		let testInstanceIds: string[] = [];
		function instanceSort(array: dt.Instance[]) {
			return array.sort((a, b) => (a.cost > b.cost ? 1 : 0));
		}

		ac.Database.createConnection(conf)
			.then((db) =>
				db
					.transaction((connection) => {
						const repoInstance = db.repositories.instance;
						const repoVideoSetting = db.repositories.videoSetting;
						const instanceList = factory.createInstances(generateParams);

						return Promise.all(instanceList.map((value) => repoInstance.save(value, connection)))
							.then((instanceIds) => {
								testInstanceIds = instanceIds.map((value) => value.id);
								const videoSettings = testInstanceIds.map((value, index) => {
									return new dt.VideoSetting({
										instanceId: value,
										videoPublishUri: videoSettingUrlList[index],
										videoFrameRate: 100,
									});
								});
								return Promise.all(videoSettings.map((value) => repoVideoSetting.save(value, connection)));
							})
							.then((_settings) => {
								// gameCode のみ檢索
								return repoInstance.findInstance("game1", undefined, undefined, undefined, undefined, 0, 10, connection);
							})
							.then((record) => {
								expect(record.length).toEqual(2);
								const sorted = instanceSort(record);
								expect(sorted[0].gameCode).toEqual("game1");
								expect(sorted[0].status).toEqual("prepare");
								expect(sorted[0].processName).toEqual("process1");
								expect(sorted[0].entryPoint).toEqual("hoge1");
								expect(sorted[1].gameCode).toEqual("game1");
								expect(sorted[1].status).toEqual("prepare");
								expect(sorted[1].processName).toEqual("process2");
								expect(sorted[1].entryPoint).toEqual("aws2");

								// gameCode status で檢索
								return repoInstance.findInstance("game2", ["running"], undefined, undefined, undefined, 0, 10, connection);
							})
							.then((record) => {
								expect(record.length).toEqual(1);
								expect(record[0].gameCode).toEqual("game2");
								expect(record[0].status).toEqual("running");
								expect(record[0].processName).toEqual("process1");
								expect(record[0].entryPoint).toEqual("hoge1");

								// status と processName で検索
								return repoInstance.findInstance(undefined, ["running", "prepare"], "process1", undefined, undefined, 0, 10, connection);
							})
							.then((record) => {
								expect(record.length).toEqual(3);
								const sorted = instanceSort(record);

								expect(sorted[0].gameCode).toEqual("game1");
								expect(sorted[0].status).toEqual("prepare");
								expect(sorted[0].processName).toEqual("process1");
								expect(sorted[0].entryPoint).toEqual("hoge1");

								expect(sorted[1].gameCode).toEqual("game2");
								expect(sorted[1].status).toEqual("running");
								expect(sorted[1].processName).toEqual("process1");
								expect(sorted[1].entryPoint).toEqual("hoge1");

								expect(sorted[2].gameCode).toEqual("game3");
								expect(sorted[2].status).toEqual("running");
								expect(sorted[2].processName).toEqual("process1");
								expect(sorted[2].entryPoint).toEqual("hoge2");

								// entryPoint で検索
								return repoInstance.findInstance(undefined, undefined, undefined, "hoge", undefined, 0, 10, connection);
							})
							.then((record) => {
								expect(record.length).toEqual(3);
								const sorted = instanceSort(record);

								expect(sorted[0].gameCode).toEqual("game1");
								expect(sorted[0].status).toEqual("prepare");
								expect(sorted[0].processName).toEqual("process1");
								expect(sorted[0].entryPoint).toEqual("hoge1");

								expect(sorted[1].gameCode).toEqual("game2");
								expect(sorted[1].status).toEqual("running");
								expect(sorted[1].processName).toEqual("process1");
								expect(sorted[1].entryPoint).toEqual("hoge1");

								expect(sorted[2].gameCode).toEqual("game3");
								expect(sorted[2].status).toEqual("running");
								expect(sorted[2].processName).toEqual("process1");
								expect(sorted[2].entryPoint).toEqual("hoge2");

								// gameCode と videoPublishUri で検索
								return repoInstance.findInstance("game1", undefined, undefined, undefined, "setting1", 0, 10, connection);
							})
							.then((record) => {
								expect(record.length).toEqual(2);
								const sorted = instanceSort(record);
								expect(sorted[0].gameCode).toEqual("game1");
								expect(sorted[0].status).toEqual("prepare");
								expect(sorted[0].processName).toEqual("process1");
								expect(sorted[0].entryPoint).toEqual("hoge1");
								expect(sorted[1].gameCode).toEqual("game1");
								expect(sorted[1].status).toEqual("prepare");
								expect(sorted[1].processName).toEqual("process2");
								expect(sorted[1].entryPoint).toEqual("aws2");
							});
					})
					.then(() => {
						return db.transaction((connection) => {
							return Promise.all(testInstanceIds.map((value) => instanceDelete(value, connection))).then(() => {
								return Promise.all(testInstanceIds.map((value) => deleteVideoSetting(value, connection)));
							});
						});
					})
					.then(() => db.end()),
			)
			.then(cb)
			.catch((err) => {
				console.log("findInstances error", err);
				cb.fail(err);
			});
	});

	it("count", (cb) => {
		const videoSettingUrlList = ["setting1", "setting2", "setting1", "setting3", "setting1"];
		// cost > この値自体検索に関係ないので sort に使ってテストしやすいようにしてます、
		const generateParams: factory.CreateInstanceParams[] = [
			{
				gameCode: "game1",
				status: "prepare",
				cost: 1,
				processName: "process1",
				entryPoint: "hoge1",
			},
			{
				gameCode: "game2",
				status: "running",
				cost: 2,
				processName: "process1",
				entryPoint: "hoge1",
			},
			{
				gameCode: "game3",
				status: "running",
				cost: 3,
				processName: "process1",
				entryPoint: "hoge2",
			},
			{
				gameCode: "game2",
				status: "prepare",
				cost: 4,
				processName: "process2",
				entryPoint: "aws1",
			},
			{
				gameCode: "game1",
				status: "prepare",
				cost: 5,
				processName: "process2",
				entryPoint: "aws2",
			},
		];

		let testInstanceIds: string[] = [];

		ac.Database.createConnection(conf)
			.then((db) =>
				db
					.transaction((connection) => {
						const repoInstance = db.repositories.instance;
						const repoVideoSetting = db.repositories.videoSetting;
						const instanceList = factory.createInstances(generateParams);

						return Promise.all(instanceList.map((value) => repoInstance.save(value, connection)))
							.then((instanceIds) => {
								testInstanceIds = instanceIds.map((value) => value.id);
								const videoSettings = testInstanceIds.map((value, index) => {
									return new dt.VideoSetting({
										instanceId: value,
										videoPublishUri: videoSettingUrlList[index],
										videoFrameRate: 100,
									});
								});
								return Promise.all(videoSettings.map((value) => repoVideoSetting.save(value, connection)));
							})
							.then((_settings) => {
								// 絞込なしの１０件まで取得で検索
								return repoInstance.count(undefined, undefined, undefined, undefined, undefined, 0, 10, connection);
							})
							.then((record) => {
								expect(parseInt(record)).toBeGreaterThan(4);
								expect(parseInt(record)).toBeLessThan(11);
								// gameCode のみ檢索
								return repoInstance.count("game1", undefined, undefined, undefined, undefined, 0, 10, connection);
							})
							.then((record) => {
								expect(record).toEqual("2");
								// gameCode status で檢索
								return repoInstance.count("game2", ["running"], undefined, undefined, undefined, 0, 10, connection);
							})
							.then((record) => {
								expect(record).toEqual("1");
								// status と processName で検索
								return repoInstance.count(undefined, ["running", "prepare"], "process1", undefined, undefined, 0, 10, connection);
							})
							.then((record) => {
								expect(record).toEqual("3");
								// entryPoint で検索
								return repoInstance.count(undefined, undefined, undefined, "hoge", undefined, 0, 10, connection);
							})
							.then((record) => {
								expect(record).toEqual("3");
								// gameCode と videoPublishUri で検索
								return repoInstance.count("game1", undefined, undefined, undefined, "setting1", 0, 10, connection);
							})
							.then((record) => {
								expect(record).toEqual("2");
							});
					})
					.then(() => {
						return db.transaction((connection) => {
							return Promise.all(testInstanceIds.map((value) => instanceDelete(value, connection))).then(() => {
								return Promise.all(testInstanceIds.map((value) => deleteVideoSetting(value, connection)));
							});
						});
					})
					.then(() => db.end()),
			)
			.then(cb)
			.catch((err) => {
				console.log("count error", err);
				cb.fail(err);
			});
	});
});
