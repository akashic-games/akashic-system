import Cast = require("@akashic/cast-util");
import PlayLike = require("./PlayLike");

class Play implements PlayLike {
	get id(): string {
		return this._id;
	}

	get gameCode(): string {
		return this._gameCode;
	}

	get parentId(): string {
		return this._parentId;
	}

	get started(): Date {
		return this._started;
	}

	get finished(): Date {
		return this._finished;
	}

	get status(): string {
		return this._status;
	}

	public static fromObject(obj: any): Play {
		if (!obj) {
			throw new TypeError("obj is not valid");
		}
		return new Play({
			id: Cast.bigint(obj.id, true, "property id is not valid"),
			gameCode: Cast.uriUnreserved(obj.gameCode, 64, false, "property gameCode is not valid"),
			parentId: Cast.bigint(obj.parentId, true, "property parentId is not valid"),
			started: Cast.date(obj.started, false, "property started is not valid"),
			finished: Cast.date(obj.finished, true, "property finished is not valid"),
			status: Cast.string(obj.status),
		});
	}
	private _id: string;
	private _gameCode: string;
	private _parentId: string;
	private _started: Date;
	private _finished: Date;
	private _status: string;

	constructor(play: PlayLike, id?: string, finished?: Date) {
		this._id = typeof id !== "undefined" ? id : play.id;
		this._gameCode = play.gameCode;
		this._parentId = play.parentId;
		this._started = play.started;
		this._finished = finished !== undefined ? finished : play.finished;
		this._status = play.status;
	}

	public toJSON(): PlayLike {
		const result: PlayLike = {
			gameCode: this._gameCode,
			started: this._started,
			status: this._status,
		};
		if (typeof this.parentId !== "undefined") {
			result.parentId = this.parentId;
		}
		if (typeof this.id !== "undefined") {
			result.id = this.id;
		}
		if (this.finished !== undefined) {
			result.finished = this.finished;
		}
		return result;
	}
}
export = Play;
