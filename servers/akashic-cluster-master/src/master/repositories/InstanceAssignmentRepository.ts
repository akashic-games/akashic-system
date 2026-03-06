import { Database } from "@akashic/akashic-active-record";
import * as dt from "@akashic/server-engine-data-types";
import { Connection } from "@akashic/tapper";
import { InstanceAssignmentStatus } from "../taskAssignments/strategies/dataTypes/InstanceAssignmentStatus";

/**
 * @akashic/akashic-active-record の database.repositories.InstanceAssignments をラップし、
 * 内部でプロセスごとの InstanceAssignmentStatus を保持するようにしたクラス。
 *
 * InstanceAssignment レコードの追加/削除時に内部情報を更新する。
 * ここで更新された内容は割り当てプロセス検索時に getAssignmentStatus() 経由で参照される。
 */
export class InstanceAssignmentRepository {
	private _database: Database;
	private _status: { [key: string]: InstanceAssignmentStatus };

	constructor(database: Database) {
		this._database = database;
		this._status = {};
	}

	public async getAssignmentStatus(identity: dt.ClusterIdentity, connection?: Connection): Promise<InstanceAssignmentStatus> {
		const key = identity.getKeyString();
		if (this._status[key] != null) {
			return this._status[key];
		}

		this._status[key] = new InstanceAssignmentStatus(identity, await this._getCurrentAssignment(identity, connection));
		return this._status[key];
	}

	public async save(instanceAssignment: dt.InstanceAssignment, connection?: Connection): Promise<void> {
		// 割り当て量を instanceAssignment.requirement 分増やす
		await this._updateInstanceAssignmentStatus(instanceAssignment.targetIdentity, instanceAssignment.requirement, connection);
		await this._database.repositories.instanceAssignment.save(instanceAssignment, connection);
	}

	public async remove(instanceAssignment: dt.InstanceAssignment, connection?: Connection): Promise<void> {
		// 割り当て量を instanceAssignment.requirement 分減らす
		await this._updateInstanceAssignmentStatus(instanceAssignment.targetIdentity, -instanceAssignment.requirement, connection);
		await this._database.repositories.instanceAssignment.remove(instanceAssignment.id, connection);
	}

	public async getByIdentity(identity: dt.ClusterIdentity, connection?: Connection): Promise<dt.InstanceAssignment[]> {
		return await this._database.repositories.instanceAssignment.getByIdentity(identity, connection);
	}

	public async removeByIdentity(identity: dt.ClusterIdentity, connection?: Connection): Promise<void> {
		delete this._status[identity.getKeyString()];
		await this._database.repositories.instanceAssignment.removeByIdentity(identity, connection);
	}

	public async removeByIdentities(identities: dt.ClusterIdentity[], connection?: Connection): Promise<void> {
		for (let i = 0; i < identities.length; ++i) {
			await this.removeByIdentity(identities[i], connection);
		}
	}

	public async getByInstanceId(instanceId: string, connection?: Connection): Promise<dt.InstanceAssignment[]> {
		return await this._database.repositories.instanceAssignment.getByInstanceId(instanceId, connection);
	}

	public async getNotByIdentities(identities: dt.ClusterIdentity[], connection?: Connection): Promise<dt.InstanceAssignment[]> {
		return await this._database.repositories.instanceAssignment.getNotByIdentities(identities, connection);
	}

	private async _getCurrentAssignment(identity: dt.ClusterIdentity, connection?: Connection): Promise<number> {
		const assignments = await this._database.repositories.instanceAssignment.getByIdentity(identity, connection);
		return assignments.reduce((acc, assignment) => acc + assignment.requirement, 0);
	}

	private async _updateInstanceAssignmentStatus(identity: dt.ClusterIdentity, delta: number, connection?: Connection): Promise<void> {
		const key = identity.getKeyString();
		let current = 0;
		if (this._status[key] != null) {
			current = this._status[key].assigned;
		} else {
			current = await this._getCurrentAssignment(identity, connection);
		}
		this._status[key] = new InstanceAssignmentStatus(identity, current + delta);
	}
}
