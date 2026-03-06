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
	get endpoint(): string {
		return this._endpoint;
	}
	get numMaxClients(): number {
		return this._numMaxClients;
	}
	get reservationEndpoint(): string {
		return this._reservationEndpoint;
	}

	public static fromObject(obj: any): Process {
		if (!obj) {
			throw new TypeError("obj is not valid");
		}
		return new Process({
			id: cast.string(obj.id, 64, false, "property id is not valid"),
			trait: cast.string(obj.trait, 32, false, "property trait is not valid"),
			endpoint: cast.string(obj.endpoint, 1024, false, "property endpoint is not valid"),
			numMaxClients: cast.number(obj.numMaxClients, false, "property numMaxClients is not valid"),
			reservationEndpoint: cast.string(obj.reservationEndpoint, 1024, false, "property reservation endpoint is not valid"),
		});
	}
	private _id: string;
	private _trait: string;
	private _endpoint: string;
	private _numMaxClients: number;
	private _reservationEndpoint: string;

	constructor(args: ProcessLike) {
		this._id = args.id;
		this._trait = args.trait;
		this._endpoint = args.endpoint;
		this._numMaxClients = args.numMaxClients;
		this._reservationEndpoint = args.reservationEndpoint;
	}

	public toJSON(): ProcessLike {
		return {
			id: this.id,
			trait: this.trait,
			endpoint: this.endpoint,
			numMaxClients: this.numMaxClients,
			reservationEndpoint: this.reservationEndpoint,
		};
	}
}
