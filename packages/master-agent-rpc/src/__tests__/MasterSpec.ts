import * as dt from "@akashic/server-engine-data-types";
import * as RPC from "..";

class MasterServer extends RPC.ProcessToMasterServerBase {
	private _processInfo: RPC.dataTypes.ProcessInfo;
	private _errorInfo: dt.ProcessStatusInfo;
	constructor(processInfo: RPC.dataTypes.ProcessInfo, errorInfo: dt.ProcessStatusInfo) {
		super({
			error: (message: string, ...args: any[]) => console.error(message, args),
			warn: (message: string, ...args: any[]) => console.error(message, args),
		});
		this._processInfo = processInfo;
		this._errorInfo = errorInfo;
	}
	join(processInfo: RPC.dataTypes.ProcessInfo): Promise<void> {
		expect(this._processInfo.clusterIdentity.fqdn).toEqual(processInfo.clusterIdentity.fqdn);
		expect(this._processInfo.clusterIdentity.type).toEqual(processInfo.clusterIdentity.type);
		expect(this._processInfo.clusterIdentity.name).toEqual(processInfo.clusterIdentity.name);
		expect(this._processInfo.clusterIdentity.czxid).toEqual(processInfo.clusterIdentity.czxid);
		expect(this._processInfo.port).toEqual(processInfo.port);
		expect(JSON.stringify(this._processInfo.machineValues)).toEqual(JSON.stringify(processInfo.machineValues));
		return Promise.resolve(undefined);
	}
	leave(clusterIdentity: dt.ClusterIdentity): Promise<void> {
		expect(this._processInfo.clusterIdentity.fqdn).toEqual(clusterIdentity.fqdn);
		expect(this._processInfo.clusterIdentity.type).toEqual(clusterIdentity.type);
		expect(this._processInfo.clusterIdentity.name).toEqual(clusterIdentity.name);
		expect(this._processInfo.clusterIdentity.czxid).toEqual(clusterIdentity.czxid);
		return Promise.resolve(undefined);
	}
	reportInstanceStatus(clusterIdentity: dt.ClusterIdentity, error: dt.ProcessStatusInfo): Promise<void> {
		expect(this._processInfo.clusterIdentity.fqdn).toEqual(clusterIdentity.fqdn);
		expect(this._processInfo.clusterIdentity.type).toEqual(clusterIdentity.type);
		expect(this._processInfo.clusterIdentity.name).toEqual(clusterIdentity.name);
		expect(this._processInfo.clusterIdentity.czxid).toEqual(clusterIdentity.czxid);
		expect(this._errorInfo.type).toEqual(error.type);
		expect(this._errorInfo.message).toEqual(error.message);
		expect(this._errorInfo.instanceId).toEqual(error.instanceId);
		return Promise.resolve(undefined);
	}
}
class MasterErrorServer extends RPC.ProcessToMasterServerBase {
	constructor() {
		super({
			error: (message: string, ...args: any[]) => console.error(message, args),
			warn: (message: string, ...args: any[]) => console.error(message, args),
		});
	}
	join(processInfo: RPC.dataTypes.ProcessInfo): Promise<void> {
		return Promise.reject(new RPC.Types.RPCError({ errorCode: RPC.Types.ErrorCode.CLUSTER_ERROR, message: "test" }));
	}
	leave(clusterIdentity: dt.ClusterIdentity): Promise<void> {
		return Promise.reject(new RPC.Types.RPCError({ errorCode: RPC.Types.ErrorCode.PARAMETER_ERROR, message: "test2" }));
	}
	reportInstanceStatus(clusterIdentity: dt.ClusterIdentity, error: dt.ProcessStatusInfo): Promise<void> {
		return Promise.reject(new RPC.Types.RPCError({ errorCode: RPC.Types.ErrorCode.RECHECKING_MASTER_ERROR, message: "rechecking" }));
	}
}

describe("Master", () => {
	it("test-master-connection", (cb) => {
		let expectedClusterIdentity = new dt.ClusterIdentity({
			fqdn: new dt.Fqdn("region.nico"),
			type: "gameRunner2",
			name: "10",
			czxid: "11233744829320",
		});
		let expectedProcessInfo: RPC.dataTypes.ProcessInfo = {
			clusterIdentity: expectedClusterIdentity,
			port: 123,
			machineValues: {
				graphicsType: "NONE",
				cpuCapacity: 100,
				graphicsCapacity: 100,
			},
		};
		let expectedErrorInfo = new dt.ProcessStatusInfo({
			type: dt.Constants.ProcessStatusType.VIDEO_STOPPED,
			message: "DMC Down",
			instanceId: "12",
		});
		let server = new MasterServer(expectedProcessInfo, expectedErrorInfo);
		server.listen(37564);
		let client = new RPC.ProcessToMasterClient({ host: "localhost", port: 37564, timeout: 1000 });
		Promise.resolve(client.join(expectedProcessInfo))
			.then<void>((_) => client.leave(expectedClusterIdentity))
			.then<void>((_) => client.reportInstanceStatus(expectedClusterIdentity, expectedErrorInfo))
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
	it("test-master-error", (cb) => {
		let expectedClusterIdentity = new dt.ClusterIdentity({
			fqdn: new dt.Fqdn("region.nico"),
			type: "gameRunner2",
			name: "10",
			czxid: "11233744829320",
		});
		let expectedProcessInfo: RPC.dataTypes.ProcessInfo = {
			clusterIdentity: expectedClusterIdentity,
			port: 123,
			machineValues: {
				graphicsType: "NONE",
				cpuCapacity: 100,
				graphicsCapacity: 100,
			},
		};
		let expectedErrorInfo = new dt.ProcessStatusInfo({
			type: dt.Constants.ProcessStatusType.VIDEO_STOPPED,
			message: "DMC Down",
			instanceId: "22",
		});
		let server = new MasterErrorServer();
		server.listen(37564);
		let client = new RPC.ProcessToMasterClient({ host: "localhost", port: 37564, timeout: 1000 });
		Promise.resolve(client.join(expectedProcessInfo))
			.catch((error) => error)
			.then((error) => {
				expect(RPC.Types.ErrorCode.CLUSTER_ERROR).toEqual(error.errorCode);
				expect("test").toEqual(error.message);
			})
			.then<void>((_) => client.leave(expectedClusterIdentity))
			.catch((error) => error)
			.then((error) => {
				expect(RPC.Types.ErrorCode.PARAMETER_ERROR).toEqual(error.errorCode);
				expect("test2").toEqual(error.message);
			})
			.then<void>((_) => client.reportInstanceStatus(expectedClusterIdentity, expectedErrorInfo))
			.catch((error) => error)
			.then((error) => {
				expect(RPC.Types.ErrorCode.RECHECKING_MASTER_ERROR).toEqual(error.errorCode);
				expect("rechecking").toEqual(error.message);
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
