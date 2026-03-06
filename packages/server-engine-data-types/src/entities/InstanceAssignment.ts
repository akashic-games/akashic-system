import ClusterIdentity = require("../valueobjects/ClusterIdentity");
import InstanceAssignmentLike = require("./InstanceAssignmentLike");
import { InstanceModule } from "./InstanceModule";

/**
 * ゲームの割り当て情報
 */
class InstanceAssignment implements InstanceAssignmentLike {
	private _id: string;
	private _targetIdentity: ClusterIdentity;
	private _targetPort: number;
	private _instanceId: string;
	private _gameCode: string;
	private _entryPoint: string;
	private _requirement: number;
	private _modules: InstanceModule[];
	/**
	 * データベース上でのID
	 */
	get id(): string {
		return this._id;
	}
	/**
	 * 割り当てられたターゲット
	 */
	get targetIdentity(): ClusterIdentity {
		return this._targetIdentity;
	}
	/**
	 * 割り当てられたターゲットの待ち受けポート
	 */
	get targetPort(): number {
		return this._targetPort;
	}
	/**
	 * 割り当てられたインスタンスのID
	 */
	get instanceId(): string {
		return this._instanceId;
	}
	/**
	 * 割り当てられたゲームのコード
	 */
	get gameCode(): string {
		return this._gameCode;
	}
	/**
	 * 実行するスクリプトのパス
	 */
	get entryPoint(): string {
		return this._entryPoint;
	}
	/**
	 * インスタンスが消費しているサーバリソース
	 */
	get requirement(): number {
		return this._requirement;
	}
	/**
	 * インスタンスにinjectされたモジュール一覧
	 */
	get modules(): InstanceModule[] {
		return this._modules;
	}

	constructor(args: InstanceAssignmentLike, id?: string) {
		this._targetIdentity = new ClusterIdentity(args.targetIdentity);
		this._targetPort = args.targetPort;
		this._instanceId = args.instanceId;
		this._gameCode = args.gameCode;
		this._entryPoint = args.entryPoint;
		this._requirement = args.requirement;
		this._modules = args.modules.map((m) => new InstanceModule(m));
		this._id = typeof id !== "undefined" ? id : args.id;
	}

	public toJSON(): InstanceAssignmentLike {
		return {
			id: this._id,
			targetIdentity: this._targetIdentity,
			targetPort: this._targetPort,
			instanceId: this._instanceId,
			gameCode: this._gameCode,
			entryPoint: this._entryPoint,
			requirement: this._requirement,
			modules: this._modules,
		};
	}
}
export = InstanceAssignment;
