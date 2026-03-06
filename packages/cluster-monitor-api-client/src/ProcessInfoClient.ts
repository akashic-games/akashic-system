import restClientCore = require("@akashic/rest-client-core");
import dt = require("@akashic/server-engine-data-types");
import BaseApiClient = require("./BaseApiClient");
import methodConfig = require("./config/methods");
import { ClusterSummary, GetProcessesRequest, Process, Processes } from "./DataTypes";

/**
 * cluster-monitor-api-server にリクエストを投げるクライアント
 */
class ProcessClient extends BaseApiClient {
	private getClusterSummaryMethod: restClientCore.Method<ClusterSummary>;
	private getProcessesMethod: restClientCore.Method<Processes>;
	private getProcessMethod: restClientCore.Method<Process>;
	private getInstancesMethod: restClientCore.Method<dt.InstanceAssignment[]>;
	private putProcessModeMethod: restClientCore.Method<void>;
	/**
	 * @param baseUrl process-info-api-serverの基底URL
	 */
	constructor(baseUrl: string) {
		super(baseUrl);
		const methods = methodConfig.process;
		this.getClusterSummaryMethod = this.getMethod(methods.getClusterSummary, (data) => data);
		this.getProcessesMethod = this.getMethod(methods.getProcesses, (data) => data);
		this.getProcessMethod = this.getMethod(methods.getProcess, (data) => data);
		this.getInstancesMethod = this.getMethod(methods.getInstances, (data) => data);
		this.putProcessModeMethod = this.getMethod(methods.putProcessMode, (data) => data);
	}

	public getClusterSummary() {
		return this.getClusterSummaryMethod.exec();
	}
	public getProcesses(args: GetProcessesRequest) {
		return this.getProcessesMethod.exec(args);
	}
	public getProcess(name: string) {
		return this.getProcessMethod.exec({ name });
	}
	public getInstances(name: string) {
		return this.getInstancesMethod.exec({ name });
	}
	public putProcessMethod(name: string, mode: string) {
		return this.putProcessModeMethod.exec({ name }, { mode });
	}
}
export = ProcessClient;
