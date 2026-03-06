import * as dt from "@akashic/server-engine-data-types";
import * as ThriftMaster from "./thrift/Master";
import * as Converters from "./Converters";
import { ClientBase, ConnectionOptions } from "./ClientBase";
import { ProcessInfo } from "./dataTypes";

export class ProcessToMasterClient extends ClientBase<ThriftMaster.Client> {
	constructor(options: ConnectionOptions) {
		super(ThriftMaster, options);
	}
	join(processInfo: ProcessInfo): Promise<void> {
		return this.getClient().then((client) => this.timeout(client.join(Converters.processInfoToRPC(processInfo)), "join request timeout"));
	}
	leave(identity: dt.ClusterIdentityLike): Promise<void> {
		return this.getClient().then((client) =>
			this.timeout(client.leave(Converters.clusterIdentityToRPC(identity)), "leave request timeout"),
		);
	}
	reportInstanceStatus(identity: dt.ClusterIdentityLike, status: dt.ProcessStatusInfo): Promise<void> {
		return this.getClient().then((client) =>
			this.timeout(
				client.reportInstanceStatus(Converters.clusterIdentityToRPC(identity), Converters.processStatusInfoToRPC(status)),
				"reportInstanceStatus request timeout",
			),
		);
	}
}
