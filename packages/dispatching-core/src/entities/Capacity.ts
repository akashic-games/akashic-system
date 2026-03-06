import * as cast from "@akashic/cast-util";
import { CapacityLike } from "./CapacityLike";

/**
 * 振り分け容量情報
 */
export class Capacity implements CapacityLike {
	get processId(): string {
		return this._processId;
	}

	get trait(): string {
		return this._trait;
	}

	get capacity(): number {
		return this._capacity;
	}

	public static fromObject(obj: any): Capacity {
		if (!obj) {
			throw new TypeError("obj is not valid");
		}
		return new Capacity({
			processId: cast.string(obj.processId, 64, false, "property processId is not valid"),
			trait: cast.string(obj.trait, 32, false, "property trait is not valid"),
			capacity: cast.number(obj.capacity, false, "property capacity is not valid"),
		});
	}
	private _processId: string;
	private _trait: string;
	private _capacity: number;

	constructor(args: CapacityLike) {
		this._processId = args.processId;
		this._trait = args.trait;
		this._capacity = args.capacity;
	}

	public toJSON(): CapacityLike {
		return {
			processId: this.processId,
			trait: this.trait,
			capacity: this.capacity,
		};
	}
}
