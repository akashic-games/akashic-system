import * as net from "net";
import * as thrift from "thrift";
import * as dt from "@akashic/server-engine-data-types";
import * as Master from "./thrift/Master";
import * as Converters from "./Converters";
import * as Types from "./thrift/cluster_types";
import { Logger } from "./Logger";
import { ProcessInfo } from "./dataTypes";

class Handler implements Master.MasterLike {
	private _that: ProcessToMasterServerBase;
	private _logger: Logger;
	constructor(that: ProcessToMasterServerBase, logger: Logger) {
		this._that = that;
		this._logger = logger;
	}
	join(processInfo: Types.ProcessInfo): Promise<void> {
		return new Promise<void>((resolve) => resolve(this._that.join(Converters.processInfoFromRPC(processInfo)))).catch((err) =>
			this.catch(err, "processからmasterへのRPCのjoinで不明なエラー"),
		);
	}
	leave(identity: Types.ClusterIdentity): Promise<void> {
		return new Promise<void>((resolve) => resolve(this._that.leave(Converters.clusterIdentityFromRPC(identity)))).catch((err) =>
			this.catch(err, "processからmasterへのRPCのleaveで不明なエラー"),
		);
	}
	reportInstanceStatus(identity: Types.ClusterIdentity, error: Types.ProcessStatusInfo): Promise<void> {
		return new Promise<void>((resolve) =>
			resolve(this._that.reportInstanceStatus(Converters.clusterIdentityFromRPC(identity), Converters.processStatusInfoFromRPC(error))),
		).catch((err) => this.catch(err, "processからmasterへのRPCのreportInstanceStatusで不明なエラー"));
	}
	private catch(err: any, unknownErrorMessage: string): Promise<any> {
		if (err instanceof Types.RPCError) {
			return Promise.reject(err);
		}
		this._logger.error(unknownErrorMessage, err);
		return Promise.reject(new Types.RPCError({ errorCode: Types.ErrorCode.SYSTEM_ERROR, message: err.toString() }));
	}
}

/**
 * サーバ側実装のベースクラス
 */
export abstract class ProcessToMasterServerBase {
	private _server: net.Server;
	constructor(logger: Logger) {
		let handler = new Handler(this, logger);
		this._server = thrift.createServer(Master, handler, {
			transport: thrift.TFramedTransport,
		});
		this._server.on("error", (err) => {
			// 接続しに来たsocketがエラーを起こしても処理できるようにエラーを握りつぶす
			// 念の為にログは出しておく
			logger.warn("thrift server detects error: ", err);
		});
	}
	listen(port: number): void {
		this._server.listen(port);
	}
	close(): void {
		this._server.close();
	}
	/**
	 * join時の処理
	 */
	abstract join(processInfo: ProcessInfo): Promise<void>;
	/**
	 * leave時の処理
	 */
	abstract leave(identity: dt.ClusterIdentityLike): Promise<void>;
	/**
	 * reportError時の処理
	 */
	abstract reportInstanceStatus(identity: dt.ClusterIdentityLike, errorInfo: dt.ProcessStatusInfo): Promise<void>;
}
