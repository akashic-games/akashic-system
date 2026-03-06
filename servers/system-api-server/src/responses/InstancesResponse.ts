import * as dt from "@akashic/server-engine-data-types";
import InstanceResponse from "./InstanceResponse";

/**
 * InstancesのSystemAPIレスポンス用Entity
 */
export default class InstancesResponse implements dt.PagingResponseLike<InstanceResponse> {
	get values(): InstanceResponse[] {
		return this._values;
	}

	get totalCount(): string {
		return this._totalCount;
	}

	public static fromDomainAndClient(instances: dt.Instance[], totalCount: string): InstancesResponse {
		if (instances.length <= 0) {
			return new InstancesResponse({ values: [] });
		}
		const results: InstanceResponse[] = [];
		instances.forEach((value) => {
			results.push(InstanceResponse.fromDomain(value));
		});
		return new InstancesResponse({ values: results, totalCount });
	}
	private _values: InstanceResponse[];
	private _totalCount: string;

	constructor(args: dt.PagingResponseLike<InstanceResponse>) {
		this._values = args.values;
		this._totalCount = args.totalCount;
	}

	public toJSON(): dt.PagingResponseLike<InstanceResponse> {
		const result: dt.PagingResponseLike<InstanceResponse> = {
			values: this._values,
		};
		if (typeof this._totalCount !== "undefined") {
			result.totalCount = this._totalCount;
		}
		return result;
	}
}
