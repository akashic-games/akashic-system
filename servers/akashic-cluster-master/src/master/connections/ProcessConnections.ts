import * as RPC from "@akashic/master-agent-rpc";
import * as dt from "@akashic/server-engine-data-types";
import { Timeout } from "../../configs";
import * as errors from "../../errors";

export class ProcessConnections {
	private _requestTimeout: Timeout;
	private _clientPool = new Map<string, RPC.MasterToProcessClient>();
	constructor(timeout: Timeout) {
		this._requestTimeout = timeout;
	}

	/**
	 * インスタンスを割り当てる
	 */
	public assignInstance(
		targetIdentity: dt.ProcessIdentityLike,
		port: number,
		instanceAssignment: RPC.dataTypes.InstanceAssignment,
	): Promise<void> {
		const client = this.getClient(new dt.ProcessIdentity(targetIdentity), port);
		if (!client) {
			return Promise.reject(
				new errors.ApplicationError("対象プロセスが見つかりませんでした", errors.ApplicationErrorCode.CLUSTER_CONFLICT_ERROR),
			);
		}
		return client.assignInstance(instanceAssignment);
	}

	/**
	 * インスタンスの割り当てを解除する
	 */
	public unassignInstance(targetIdentity: dt.ProcessIdentityLike, port: number, instanceId: string): Promise<void> {
		const client = this.getClient(new dt.ProcessIdentity(targetIdentity), port);
		if (!client) {
			return Promise.reject(
				new errors.ApplicationError("対象プロセスが見つかりませんでした", errors.ApplicationErrorCode.CLUSTER_CONFLICT_ERROR),
			);
		}
		return client.unassignInstance(instanceId);
	}

	/**
	 * インスタンスの割り当てを複数解除する
	 */
	public unassignInstances(targets: { targetIdentity: dt.ProcessIdentityLike; targetPort: number }[], instanceId: string) {
		return Promise.all(targets.map((target) => this.unassignInstance(target.targetIdentity, target.targetPort, instanceId)));
	}

	/**
	 * インスタンスの実行を一時停止する
	 */
	public pauseInstance(targetIdentity: dt.ProcessIdentityLike, port: number, instanceId: string): Promise<void> {
		const client = this.getClient(new dt.ProcessIdentity(targetIdentity), port);
		if (!client) {
			return Promise.reject(
				new errors.ApplicationError("対象プロセスが見つかりませんでした", errors.ApplicationErrorCode.CLUSTER_CONFLICT_ERROR),
			);
		}
		return client.pauseInstance(instanceId);
	}

	/**
	 * インスタンス実行一時停止を解除する
	 */
	public resumeInstance(targetIdentity: dt.ProcessIdentityLike, port: number, instanceId: string): Promise<void> {
		const client = this.getClient(new dt.ProcessIdentity(targetIdentity), port);
		if (!client) {
			return Promise.reject(
				new errors.ApplicationError("対象プロセスが見つかりませんでした", errors.ApplicationErrorCode.CLUSTER_CONFLICT_ERROR),
			);
		}
		return client.resumeInstance(instanceId);
	}

	private getClient(identity: dt.ProcessIdentity, port: number): RPC.MasterToProcessClient {
		const poolKey = this.getPoolKey(identity, port);
		if (this._clientPool.has(poolKey)) {
			return this._clientPool.get(poolKey);
		}
		const client = new RPC.MasterToProcessClient(
			{
				host: identity.fqdn.value,
				port,
				timeout: this._requestTimeout.default,
			},
			this._requestTimeout.assignGame,
		);
		this._clientPool.set(poolKey, client);
		return client;
	}

	private getPoolKey(identity: dt.ProcessIdentity, port: number): string {
		return identity.getKeyString() + "." + port;
	}
}
