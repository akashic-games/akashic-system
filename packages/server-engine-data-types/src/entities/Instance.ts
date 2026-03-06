import Cast = require("@akashic/cast-util");
import InstanceLike = require("./InstanceLike");
import { InstanceModule } from "./InstanceModule";

class Instance implements InstanceLike {
	/**
	 * インスタンスのID
	 */
	get id(): string {
		return this._id;
	}

	/**
	 * 起動するゲーム
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
	 * このinstanceのループの動作モード
	 */
	get modules(): InstanceModule[] {
		return this._modules;
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

	/**
	 * 実行する js ファイルのパス
	 */
	get entryPoint(): string {
		return this._entryPoint;
	}

	public static fromObject(obj: any): Instance {
		if (!obj) {
			throw new TypeError("obj is not valid");
		}
		return new Instance({
			id: Cast.bigint(obj.id, true, "property id is not valid"),
			gameCode: Cast.uriUnreserved(obj.gameCode, 64, false, "property gameCode is not valid"),
			modules: InstanceModule.fromObjects(obj.modules),
			status: Cast.string(obj.status, 32, false, "property status is not valid"),
			region: Cast.string(obj.region, 32, false, "property region is not valid"),
			exitCode: Cast.int(obj.exitCode, true, "property exitCode is not valid"),
			cost: Cast.int(obj.cost, false, "property cost is not valid"),
			processName: Cast.string(obj.processName, 128, true, "property processName is not valid"),
			entryPoint: Cast.string(obj.entryPoint, 512, false, "property entryPoint is not valid"),
		});
	}
	private _id: string;
	private _gameCode: string;
	private _status: string;
	private _region: string;
	private _exitCode: number;
	private _modules: InstanceModule[];
	private _cost: number;
	private _processName: string;
	private _entryPoint: string;

	constructor(args: InstanceLike, id?: string, exitCode?: number, processName?: string) {
		this._id = typeof id !== "undefined" ? id : args.id;
		this._modules = args.modules.map((m) => new InstanceModule(m));
		this._gameCode = args.gameCode;
		this._status = args.status;
		this._region = args.region;
		this._exitCode = exitCode !== undefined ? exitCode : args.exitCode;
		this._cost = args.cost;
		this._entryPoint = args.entryPoint;
		this._processName = processName !== undefined ? processName : args.processName;
	}
	public toJSON(): InstanceLike {
		const result: InstanceLike = {
			gameCode: this._gameCode,
			modules: this._modules,
			status: this._status,
			region: this._region,
			cost: this._cost,
			entryPoint: this._entryPoint,
		};
		if (this._id !== undefined) {
			result.id = this._id;
		}
		if (this._exitCode !== undefined) {
			result.exitCode = this._exitCode;
		}
		if (this._processName !== undefined) {
			result.processName = this._processName;
		}
		return result;
	}
}
export = Instance;
