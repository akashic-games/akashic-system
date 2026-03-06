import * as Cast from "@akashic/cast-util";
import { InstanceModuleLike } from "./InstanceModuleLike";

/**
 * インスタンスに付与するモジュール情報
 */
export class InstanceModule implements InstanceModuleLike {
	/**
	 * モジュール名
	 */
	get code(): string {
		return this._code;
	}
	/**
	 * モジュール一覧
	 */
	get values(): any {
		return this._values;
	}

	public static fromObject(obj: any): InstanceModule {
		if (!obj) {
			throw new TypeError("obj is not valid");
		}
		return new InstanceModule({
			code: Cast.string(obj.code, undefined, false, "instanceModule.code is not vaid"),
			values: obj.values,
		});
	}
	public static fromObjects(objects: any[]): InstanceModule[] {
		if (!Array.isArray(objects)) {
			throw new TypeError("objects is not valid");
		}
		return objects.map((obj) => InstanceModule.fromObject(obj));
	}
	private _code: string;
	private _values: any;

	constructor(args: InstanceModuleLike) {
		this._code = args.code;
		this._values = args.values;
	}
	public toJSON(): InstanceModuleLike {
		return {
			code: this._code,
			values: this._values,
		};
	}
}
