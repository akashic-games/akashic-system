import * as net from "net";
import * as thrift from "thrift";
import * as Process from "./thrift/Process";
import * as Converters from "./Converters";
import * as Types from "./thrift/cluster_types";
import { Logger } from "./Logger";
import { InstanceAssignment } from "./dataTypes";

class Handler implements Process.ProcessLike {
	private _that: MasterToProcessServerBase;
	private _logger: Logger;
	constructor(that: MasterToProcessServerBase, logger: Logger) {
		this._that = that;
		this._logger = logger;
	}
	assignInstance(instanceAssignment: Types.InstanceAssignment): Promise<void> {
		return new Promise<void>((resolve) =>
			resolve(this._that.assignInstance(Converters.instanceAssignmentFromRPC(instanceAssignment))),
		).catch((err) => this.catch(err, "masterからprocessへのRPCのassignInstanceで不明なエラー"));
	}
	unassignInstance(instanceId: string): Promise<void> {
		return new Promise<void>((resolve) => resolve(this._that.unassignInstance(instanceId))).catch((err) =>
			this.catch(err, "masterからprocessへのRPCのunassignInstanceで不明なエラー"),
		);
	}
	pauseInstance(instanceId: string): Promise<void> {
		return new Promise<void>((resolve) => resolve(this._that.pauseInstance(instanceId))).catch((err) =>
			this.catch(err, "masterからprocessへのRPCのunassignInstanceで不明なエラー"),
		);
	}
	resumeInstance(instanceId: string): Promise<void> {
		return new Promise<void>((resolve) => resolve(this._that.resumeInstance(instanceId))).catch((err) =>
			this.catch(err, "masterからprocessへのRPCのunassignInstanceで不明なエラー"),
		);
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
export abstract class MasterToProcessServerBase {
	private _server: net.Server;
	constructor(logger: Logger) {
		let handler = new Handler(this, logger);
		this._server = thrift.createServer(Process, handler, {
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
	 * assignInstance時の処理
	 */
	abstract assignInstance(instanceAssignment: InstanceAssignment): Promise<void>;
	/**
	 * unassignInstance時の処理
	 */
	abstract unassignInstance(instanceId: string): Promise<void>;
	/**
	 * pauseInstance時の処理
	 */
	abstract pauseInstance(instanceId: string): Promise<void>;
	/**
	 * resumeInstance時の処理
	 */
	abstract resumeInstance(instanceId: string): Promise<void>;
}
