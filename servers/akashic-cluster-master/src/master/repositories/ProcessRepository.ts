import { Database } from "@akashic/akashic-active-record";
import { ClusterIdentity, ClusterIdentityLike, Process, ProcessIdentity } from "@akashic/server-engine-data-types";
import { Connection } from "@akashic/tapper";

/**
 * @akashic/akashic-active-record の database.repositories.process をラップする。
 * 内部でプロセス情報を保持し、割り当て対象検索時に呼ばれる getAll メソッドで
 * 内部情報を返すことで、検索時間を短縮することを目的とする。
 *
 * 初回の getAll() 呼び出し時に DB 上の情報と同期され、
 * saveOrUpdate/remove/removeProcesses 時に内部情報が更新される。
 */
export class ProcessRepository {
	private _database: Database;
	private _processes: { [key: string]: Process };
	private _synchronized: boolean;

	constructor(database: Database) {
		this._database = database;
		this._processes = {};
		this._synchronized = false;
	}

	public async syncDatabase(connection?: Connection): Promise<void> {
		const processes = await this._database.repositories.process.getAll(connection);
		this._processes = {};
		processes.forEach((process) => {
			this._processes[process.clusterIdentity.getKeyString()] = process;
		});
		this._synchronized = true;
	}

	public async saveOrUpdate(process: Process, connection?: Connection): Promise<Process> {
		this._processes[process.clusterIdentity.getKeyString()] = process;
		return await this._database.repositories.process.saveOrUpdate(process, connection);
	}

	public async getAll(connection?: Connection): Promise<Process[]> {
		if (!this._synchronized) {
			await this.syncDatabase(connection);
		}
		return Object.keys(this._processes).map((key) => this._processes[key]);
	}

	public async remove(identity: ClusterIdentity, connection?: Connection): Promise<void> {
		await this.removeProcesses([identity], connection);
	}

	public async removeProcesses(identities: ClusterIdentity[], connection?: Connection): Promise<void> {
		identities.forEach((identity) => {
			delete this._processes[identity.getKeyString()];
		});
		await this._database.repositories.process.removeProcesses(identities, connection);
	}

	public find(fqdn?: string, type?: string, offset?: number, limit?: number, connection?: Connection): Promise<Process[]> {
		return this._database.repositories.process.find(fqdn, type, offset, limit, connection);
	}

	public gets(identities: ClusterIdentityLike[], connection?: Connection): Promise<Process[]> {
		return this._database.repositories.process.gets(identities, connection);
	}

	public getNotByIdentities(identities: ClusterIdentity[], connection?: Connection): Promise<Process[]> {
		return this._database.repositories.process.getNotByIdentities(identities, connection);
	}

	public getExcludedProcess(connection?: Connection): Promise<ProcessIdentity[]> {
		return this._database.repositories.excludedProcess.getAll(connection);
	}
}
