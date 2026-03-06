import * as cast from "@akashic/cast-util";
import { ProcessLike } from "./ProcessLike";

/**
 * プロセス情報
 */
export class Process implements ProcessLike {
	get id(): string {
		return this._id;
	}

	get trait(): string {
		return this._trait;
	}

	get playId(): string {
		return this._playId;
	}

	get numDispatchedClients(): number {
		return this._numDispatchedClients;
	}

	public static fromObject(obj: any): Process {
		if (!obj) {
			throw new TypeError("obj is not valid");
		}
		return new Process({
			id: cast.string(obj.id, 64, false, "property id is not valid"),
			trait: cast.string(obj.trait, 32, false, "property trait is not valid"),
			playId: cast.bigint(obj.playId, false, "property playId is not valid"),
			numDispatchedClients: cast.number(obj.numDispatchedClients, false, "property numDispatchedClients is not valid"),
		});
	}
	private _id: string;
	private _trait: string;
	private _playId: string;
	private _numDispatchedClients: number;

	constructor(args: ProcessLike) {
		this._id = args.id;
		this._trait = args.trait;
		this._playId = args.playId;
		this._numDispatchedClients = args.numDispatchedClients;
	}

	public toJSON(): ProcessLike {
		return {
			id: this.id,
			trait: this.trait,
			playId: this.playId,
			numDispatchedClients: this.numDispatchedClients,
		};
	}
}
