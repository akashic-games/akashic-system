import * as RPC from "..";

class ProcessServer extends RPC.MasterToProcessServerBase {
	private _instance: RPC.dataTypes.InstanceAssignment;
	constructor(instance: RPC.dataTypes.InstanceAssignment) {
		super({
			error: (message: string, ...args: any[]) => console.error(message, args),
			warn: (message: string, ...args: any[]) => console.error(message, args),
		});
		this._instance = instance;
	}

	assignInstance(instanceAssignment: RPC.dataTypes.InstanceAssignment): Promise<void> {
		expect(this._instance.instanceId).toEqual(instanceAssignment.instanceId);
		expect(this._instance.gameCode).toEqual(instanceAssignment.gameCode);
		expect(this._instance.entryPoint).toEqual(instanceAssignment.entryPoint);
		expect(this._instance.modules.length).toEqual(instanceAssignment.modules.length);
		for (var index = 0; index < this._instance.modules.length; index++) {
			expect(JSON.stringify(this._instance.modules[index])).toEqual(JSON.stringify(instanceAssignment.modules[index]));
		}
		expect(this._instance.playId).toEqual(instanceAssignment.playId);
		expect(this._instance.parentPlayIds.length).toEqual(instanceAssignment.parentPlayIds.length);
		for (var i = 0; i < this._instance.parentPlayIds.length; i++) {
			expect(JSON.stringify(this._instance.parentPlayIds[i])).toEqual(JSON.stringify(instanceAssignment.parentPlayIds[i]));
		}
		return Promise.resolve(undefined);
	}
	unassignInstance(instanceId: string): Promise<void> {
		expect(instanceId).toEqual(this._instance.instanceId);
		return Promise.resolve(undefined);
	}
	pauseInstance(instanceId: string): Promise<void> {
		expect(instanceId).toEqual(this._instance.instanceId);
		return Promise.resolve(undefined);
	}
	resumeInstance(instanceId: string): Promise<void> {
		expect(instanceId).toEqual(this._instance.instanceId);
		return Promise.resolve(undefined);
	}
}
class ProcessErrorServer extends RPC.MasterToProcessServerBase {
	constructor() {
		super({
			error: (message: string, ...args: any[]) => console.error(message, args),
			warn: (message: string, ...args: any[]) => console.error(message, args),
		});
	}
	assignInstance(instanceAssignment: RPC.dataTypes.InstanceAssignment): Promise<void> {
		return Promise.reject(new RPC.Types.RPCError({ errorCode: RPC.Types.ErrorCode.CLUSTER_ERROR, message: "test" }));
	}
	unassignInstance(instanceId: string): Promise<void> {
		return Promise.reject(new RPC.Types.RPCError({ errorCode: RPC.Types.ErrorCode.SYSTEM_ERROR, message: "test3" }));
	}
	pauseInstance(instanceId: string): Promise<void> {
		return Promise.reject(new RPC.Types.RPCError({ errorCode: RPC.Types.ErrorCode.SYSTEM_ERROR, message: "test4" }));
	}
	resumeInstance(instanceId: string): Promise<void> {
		return Promise.reject(new RPC.Types.RPCError({ errorCode: RPC.Types.ErrorCode.SYSTEM_ERROR, message: "test5" }));
	}
}
describe("Process", () => {
	it("test-process-connection", (cb) => {
		let expectedInstanceAssignment: RPC.dataTypes.InstanceAssignment = {
			instanceId: "1234",
			gameCode: "ncg777",
			entryPoint: "engines/akashic/v1.0/entry.js",
			modules: [
				{
					code: "video",
					values: {
						videoPublishUri: "dmtp://publish.nico/video",
						videoFrameRate: 10,
					},
				},
				{
					code: "foo",
					values: {
						playId: "777",
						executionMode: "passive",
						loopMode: "bar",
						playBackRate: 1.0,
					},
				},
			],
			cost: 10,
			playId: "777",
			parentPlayIds: ["111"],
		};
		let server = new ProcessServer(expectedInstanceAssignment);
		server.listen(37564);
		let client = new RPC.MasterToProcessClient({ host: "localhost", port: 37564, timeout: 1000 }, 1000);
		Promise.resolve(client.assignInstance(expectedInstanceAssignment))
			.then<void>((_) => client.pauseInstance(expectedInstanceAssignment.instanceId))
			.then<void>((_) => client.resumeInstance(expectedInstanceAssignment.instanceId))
			.then<void>((_) => client.unassignInstance(expectedInstanceAssignment.instanceId))
			.then(() => {
				client.close();
				server.close();
				cb();
			})
			.catch((err) =>
				setImmediate(() => {
					throw err;
				}),
			);
	});
	it("test-agent-error", (cb) => {
		let expectedInstanceAssignment: RPC.dataTypes.InstanceAssignment = {
			instanceId: "1234",
			gameCode: "ncg777",
			entryPoint: "engines/akashic/v1.0/entry.js",
			modules: [
				{
					code: "video",
					values: {
						videoPublishUri: "dmtp://publish.nico/video",
						videoFrameRate: 10,
					},
				},
				{
					code: "foo",
					values: {
						playId: "777",
						executionMode: "passive",
						loopMode: "bar",
						playBackRate: 1.0,
					},
				},
			],
			cost: 10,
			playId: "777",
			parentPlayIds: ["111"],
		};
		let server = new ProcessErrorServer();
		server.listen(37564);
		let client = new RPC.MasterToProcessClient({ host: "localhost", port: 37564, timeout: 1000 }, 1000);
		Promise.resolve(client.assignInstance(expectedInstanceAssignment))
			.catch((error) => error)
			.then((error) => {
				expect(RPC.Types.ErrorCode.CLUSTER_ERROR).toEqual(error.errorCode);
				expect("test").toEqual(error.message);
			})
			.then<void>((_) => client.unassignInstance(expectedInstanceAssignment.instanceId))
			.catch((error) => error)
			.then((error) => {
				expect(RPC.Types.ErrorCode.SYSTEM_ERROR).toEqual(error.errorCode);
				expect("test3").toEqual(error.message);
			})
			.then<void>((_) => client.pauseInstance(expectedInstanceAssignment.instanceId))
			.catch((error) => error)
			.then((error) => {
				expect(RPC.Types.ErrorCode.SYSTEM_ERROR).toEqual(error.errorCode);
				expect("test4").toEqual(error.message);
			})
			.then<void>((_) => client.resumeInstance(expectedInstanceAssignment.instanceId))
			.catch((error) => error)
			.then((error) => {
				expect(RPC.Types.ErrorCode.SYSTEM_ERROR).toEqual(error.errorCode);
				expect("test5").toEqual(error.message);
			})
			.then(() => {
				client.close();
				server.close();
				cb();
			})
			.catch((err) =>
				setImmediate(() => {
					throw err;
				}),
			);
	});
});
