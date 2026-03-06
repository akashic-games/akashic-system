import { context } from "@akashic-system/logger";
import * as RPC from "@akashic/master-agent-rpc";
import * as dt from "@akashic/server-engine-data-types";
import { MasterStatus } from "../../core";
import * as errors from "../../errors";
import { ErrorProcessor } from "../../master/controls/ErrorProcessor";
import { InstanceManager } from "../../master/controls/InstanceManager";
import { LogFactory } from "../../util/LogFactory";
import { ProcessAcceptor } from "../controls/ProcessAcceptor";

type MasterController = import("../../core").MasterController;

/**
 * Processの接続を受け付けるサーバ
 */
export class ProcessToMasterServer extends RPC.ProcessToMasterServerBase {
	private _port: number;
	private _acceptor: ProcessAcceptor;
	private _masterController: MasterController;
	private _instanceManager: InstanceManager;
	private _errorProcessor: ErrorProcessor;
	private _logFactory: LogFactory;
	constructor(
		port: number,
		acceptor: ProcessAcceptor,
		masterController: MasterController,
		instanceManager: InstanceManager,
		errorProcessor: ErrorProcessor,
		logFactory: LogFactory,
	) {
		super(logFactory.getLogger("out"));
		this._port = port;
		this._acceptor = acceptor;
		this._masterController = masterController;
		this._instanceManager = instanceManager;
		this._errorProcessor = errorProcessor;
		this._logFactory = logFactory;
	}
	public listen() {
		const log = this._logFactory.getLogger("out");
		log.trace("process受付サーバの開始");
		super.listen(this._port);
	}
	public join(processInfo: RPC.dataTypes.ProcessInfo): Promise<void> {
		const logger = this._logFactory.getLogger("out", { fqdn: processInfo.clusterIdentity.fqdn.value });
		logger.trace("processの接続受付");
		if (!this._masterController.isMaster) {
			if (this._masterController.masterStatus === MasterStatus.reChecking) {
				return Promise.reject(
					new RPC.Types.RPCError({
						errorCode: RPC.Types.ErrorCode.RECHECKING_MASTER_ERROR,
						message: "master rechecking",
					}),
				);
			}
			return Promise.reject(new RPC.Types.RPCError({ errorCode: RPC.Types.ErrorCode.NOT_MASTER_ERROR, message: "not master" }));
		}

		// コンパイル通らないので as any
		// return this._acceptor.accept(new dt.ClusterIdentity(processInfo.clusterIdentity as any), processInfo.port, processInfo.machineValues)
		return this._acceptor
			.accept(new dt.ClusterIdentity(processInfo.clusterIdentity as any), processInfo.port, processInfo.machineValues)
			.then(() => {
				return;
			})
			.catch((error) => {
				if (!(error instanceof errors.ApplicationError)) {
					return Promise.reject(error);
				}
				switch (error.code) {
					case errors.ApplicationErrorCode.CLUSTER_CONFLICT_ERROR:
						const message = "processの接続受付znodeなしエラー";
						logger.warn(message);
						return Promise.reject(new RPC.Types.RPCError({ errorCode: RPC.Types.ErrorCode.CLUSTER_ERROR, message }));
					default:
						return Promise.reject(error);
				}
			});
	}

	// コンパイル通らないので `as any`
	// public leave(clusterIdentity: dt.ClusterIdentity): Promise<void> {
	public leave(clusterIdentity: any): Promise<void> {
		const logger = this._logFactory.getLogger("out", { fqdn: clusterIdentity.fqdn.value });
		logger.trace("プロセス離脱報告");
		if (!this._masterController.isMaster) {
			if (this._masterController.masterStatus === MasterStatus.reChecking) {
				return Promise.reject(
					new RPC.Types.RPCError({
						errorCode: RPC.Types.ErrorCode.RECHECKING_MASTER_ERROR,
						message: "master rechecking",
					}),
				);
			}
			return Promise.reject(new RPC.Types.RPCError({ errorCode: RPC.Types.ErrorCode.NOT_MASTER_ERROR, message: "not master" }));
		}
		return this._acceptor.leave(clusterIdentity).catch((error) => {
			if (!(error instanceof errors.ApplicationError)) {
				return Promise.reject(error);
			}
			switch (error.code) {
				case errors.ApplicationErrorCode.CLUSTER_CONFLICT_ERROR:
					const message = "processの離脱報告znodeなしエラー";
					logger.warn(
						message,
						context({
							key: clusterIdentity.getKeyString(),
						}),
					);
					return Promise.reject(new RPC.Types.RPCError({ errorCode: RPC.Types.ErrorCode.CLUSTER_ERROR, message }));
				default:
					return Promise.reject(error);
			}
		});
	}

	// コンパイル通らないので `as any`
	// public reportInstanceStatus(identity: dt.ClusterIdentity, statusInfo: dt.ProcessStatusInfo): Promise<void> {
	public reportInstanceStatus(identity: any, statusInfo: any): Promise<void> {
		const logger = this._logFactory.getLogger("out", { fqdn: identity.fqdn.value });
		logger.trace("processからのインスタンス状態報告");
		if (!this._masterController.isMaster) {
			if (this._masterController.masterStatus === MasterStatus.reChecking) {
				return Promise.reject(
					new RPC.Types.RPCError({
						errorCode: RPC.Types.ErrorCode.RECHECKING_MASTER_ERROR,
						message: "master rechecking",
					}),
				);
			}
			return Promise.reject(new RPC.Types.RPCError({ errorCode: RPC.Types.ErrorCode.NOT_MASTER_ERROR, message: "not master" }));
		}
		let processor: Promise<void>;
		if (statusInfo.type === dt.Constants.ProcessStatusType.INSTANCE_FINISHED) {
			processor = this._instanceManager.shutdown(statusInfo.instanceId).then((_instance): void => undefined);
		} else {
			processor = this._errorProcessor.processErrorReport(statusInfo);
		}
		return processor.catch<void>((err) => {
			if (err instanceof errors.ApplicationError && err.code === errors.ApplicationErrorCode.NOT_MASTER_ERROR) {
				err = new RPC.Types.RPCError({
					errorCode: RPC.Types.ErrorCode.RECHECKING_MASTER_ERROR,
					message: err.message,
				});
			}
			return Promise.reject(err);
		});
	}
}
