import * as Cast from "@akashic/cast-util";
import { ReportLike } from "./ReportLike";

export class Report implements ReportLike {
	get id(): string {
		return this._id;
	}

	get searchKey(): string {
		return this._searchKey;
	}

	get searchValue(): string {
		return this._searchValue;
	}

	get createdAt(): Date {
		return this._createdAt;
	}

	get value(): string {
		return this._value;
	}

	public static fromObject(obj: any): Report {
		if (!obj) {
			throw new TypeError("obj is not valid");
		}
		return new Report({
			id: Cast.bigint(obj.id, true, "property id is not valid"),
			searchKey: Cast.string(obj.searchKey, 32, false, "property searchKey is not valid"),
			searchValue: Cast.string(obj.searchValue, 32, false, "property searchValue is not valid"),
			createdAt: Cast.date(obj.createdAt, true, "property createdAt is not valid") || new Date(),
			value: Cast.string(obj.value, 65535, false, "property value is not valid"),
		});
	}
	private _id: string;
	private _searchKey: string;
	private _searchValue: string;
	private _createdAt: Date;
	private _value: string;

	constructor(report: ReportLike, id?: string) {
		this._id = typeof id !== "undefined" ? id : report.id;
		this._searchKey = report.searchKey;
		this._searchValue = report.searchValue;
		this._createdAt = report.createdAt;
		this._value = report.value;
	}

	public toJSON(): ReportLike {
		const result: ReportLike = {
			searchKey: this._searchKey,
			searchValue: this._searchValue,
			createdAt: this._createdAt,
			value: this._value,
		};
		if (typeof this.id !== "undefined") {
			result.id = this.id;
		}
		return result;
	}
}
