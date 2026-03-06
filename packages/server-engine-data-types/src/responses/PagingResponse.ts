import Cast = require("@akashic/cast-util");
import PagingResponseLike = require("./PagingResponseLike");

class PagingResponse<T> implements PagingResponseLike<T> {
	get values(): T[] {
		return this._values;
	}
	get totalCount(): string {
		return this._totalCount;
	}
	public static fromObject<TValue>(obj: any, TClass: { fromObject(obj: any): TValue }): PagingResponse<TValue> {
		if (!obj) {
			throw new TypeError("obj is not valid");
		}
		if (!Array.isArray(obj.values)) {
			throw new TypeError("values is not valid");
		}
		return new PagingResponse<TValue>({
			values: (obj.values as any[]).map((value: any) => TClass.fromObject(value)),
			totalCount: Cast.bigint(obj.totalCount, true, "totalCount is not valid"),
		});
	}
	private _values: T[];
	private _totalCount: string;
	constructor(args: PagingResponseLike<T>) {
		this._values = args.values;
		this._totalCount = args.totalCount;
	}
	public toJSON(): PagingResponseLike<T> {
		const result: PagingResponseLike<T> = {
			values: this._values,
		};
		if (this._totalCount !== undefined) {
			result.totalCount = this._totalCount;
		}
		return result;
	}
}
export = PagingResponse;
