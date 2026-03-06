import * as RPC from "../src";
import * as dt from "@akashic/server-engine-data-types";

class MasterServer extends RPC.ProcessToMasterServerBase {
	constructor() {
		super({
			error: (message, ...args) => console.error(message, args),
			warn: (message, ...args) => console.error(message, args),
		});
	}
	join(processInfo: RPC.dataTypes.ProcessInfo): Promise<void> {
		console.log("join");
		return Promise.resolve(undefined);
	}
	leave(clusterIdentity: dt.ClusterIdentity): Promise<void> {
		console.log("report");
		return Promise.resolve(undefined);
	}
	reportInstanceStatus(clusterIdentity: dt.ClusterIdentity): Promise<void> {
		console.log("reportInstanceStatus");
		return Promise.resolve(undefined);
	}
}
let server = new MasterServer();
server.listen(37564);
