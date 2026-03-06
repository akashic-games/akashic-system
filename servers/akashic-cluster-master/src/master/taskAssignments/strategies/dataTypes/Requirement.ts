/**
 * ゲーム起動に必要な条件
 */
export class Requirement {
	private _processType: string;
	private _cost: number;
	private _video: boolean;
	private _trait: string[];
	get processType() {
		return this._processType;
	}
	get cost() {
		return this._cost;
	}
	get video() {
		return this._video;
	}
	get trait() {
		return this._trait;
	}
	constructor(processType: string, cost: number, video: boolean, trait?: string[]) {
		this._processType = processType;
		this._cost = cost;
		this._video = video;
		this._trait = trait || undefined;
	}
	public toJSON() {
		return {
			processType: this._processType,
			cost: this._cost,
			video: this._video,
			trait: this._trait,
		};
	}
}
