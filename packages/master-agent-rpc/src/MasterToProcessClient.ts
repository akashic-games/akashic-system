import * as ThriftProcess from "./thrift/Process";
import * as Converters from "./Converters";
import { ClientBase, ConnectionOptions } from "./ClientBase";
import { InstanceAssignment } from "./dataTypes";

export class MasterToProcessClient extends ClientBase<ThriftProcess.Client> {
	private _assignInstanceTimeout: number;
	constructor(options: ConnectionOptions, assignInstanceTimeout: number) {
		super(ThriftProcess, options);
		this._assignInstanceTimeout = assignInstanceTimeout;
	}
	/**
	 * processにinstance割り当て指示を行う
	 */
	assignInstance(instanceAssignment: InstanceAssignment): Promise<void> {
		return this.getClient().then((client) =>
			this.timeout(
				client.assignInstance(Converters.instanceAssignmentToRPC(instanceAssignment)),
				"assignInstance request timeout",
				this._assignInstanceTimeout,
			),
		);
	}
	/**
	 * processにinstance割り当て解除指示を行う
	 */
	unassignInstance(instanceId: string): Promise<void> {
		return this.getClient().then((client) => this.timeout(client.unassignInstance(instanceId), "unassignInstance request timeout"));
	}
	/**
	 * processにinstance一時停止指示を行う
	 */
	pauseInstance(instanceId: string): Promise<void> {
		return this.getClient().then((client) => this.timeout(client.pauseInstance(instanceId), "pauseInstance request timeout"));
	}
	/**
	 * processにinstance一時停止解除指示を行う
	 */
	resumeInstance(instanceId: string): Promise<void> {
		return this.getClient().then((client) => this.timeout(client.resumeInstance(instanceId), "resumeInstance request timeout"));
	}
}
