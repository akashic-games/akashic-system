// InstanceModule が export * で宣言されているため、こちら側で明示的に名前を付ける必要がある
import { InstanceLike, InstanceModule } from "@akashic/server-engine-data-types";
import { InstanceResponseLike } from "./InstanceResponseLike";

export default class InstanceResponse implements InstanceResponseLike {
	/**
	 * インスタンスのID
	 */
	get id(): string {
		return this._id;
	}

	/**
	 * 起動するゲーム識別子
	 */
	get gameCode(): string {
		return this._gameCode;
	}

	/**
	 * instanceの状態
	 */
	get status(): string {
		return this._status;
	}

	/**
	 * このinstanceに指定されている各種モジュール情報
	 */
	get modules(): InstanceModule[] {
		return this._modules;
	}

	/**
	 * このinstanceの稼働先
	 */
	get region(): string {
		return this._region;
	}

	/**
	 * 終了コード
	 */
	get exitCode(): number {
		return this._exitCode;
	}

	/**
	 * 実行する js ファイルのパス
	 */
	get entryPoint(): string {
		return this._entryPoint;
	}

	/**
	 * 割り当てコスト
	 */
	get cost(): number {
		return this._cost;
	}

	/**
	 * インスタンス稼働先のプロセス(game-runner)の識別子
	 */
	get processName(): string {
		return this._processName;
	}

	public static fromDomain(instance: InstanceLike): InstanceResponse {
		return new InstanceResponse({
			id: instance.id,
			gameCode: instance.gameCode,
			status: instance.status,
			modules: instance.modules,
			region: instance.region,
			exitCode: instance.exitCode,
			entryPoint: instance.entryPoint,
			cost: instance.cost,
			processName: instance.processName,
		});
	}
	private _id: string;
	private _gameCode: string;
	private _status: string;
	private _modules: InstanceModule[];
	private _region: string;
	private _exitCode: number;
	private _entryPoint: string;
	private _cost: number;
	private _processName: string;

	constructor(args: InstanceResponseLike) {
		this._id = args.id;
		this._gameCode = args.gameCode;
		this._status = args.status;
		this._modules = args.modules ? args.modules.map((item) => new InstanceModule(item)) : undefined;
		this._region = args.region;
		this._exitCode = args.exitCode;
		this._entryPoint = args.entryPoint;
		this._cost = args.cost;
		this._processName = args.processName ? args.processName : undefined;
	}

	public toJSON(): InstanceResponseLike {
		const result: InstanceResponseLike = {
			id: this._id,
			gameCode: this._gameCode,
			status: this._status,
			modules: this._modules,
			region: this._region,
			entryPoint: this._entryPoint,
			cost: this._cost,
		};
		if (this._exitCode !== undefined) {
			result.exitCode = this._exitCode;
		}
		if (this._processName !== undefined) {
			result.processName = this._processName;
		}
		return result;
	}
}
