import { PlayToken, PlayTokenPermissionLike } from "@akashic/server-engine-data-types";
import { EventEmitter } from "events";

export class PlayTokenHolder extends EventEmitter {
	private _playToken: PlayToken;
	private _sessionId: string;
	private _parentId: string;
	private _revoked: boolean;

	constructor(playToken: PlayToken, sessionId: string, parentId?: string) {
		super();
		this._playToken = playToken;
		this._sessionId = sessionId;
		this._parentId = parentId;
		this._revoked = false;
	}

	get playToken(): PlayToken {
		return this._playToken;
	}

	get sessionId(): string {
		return this._sessionId;
	}

	get parentId(): string {
		return this._parentId;
	}

	get revoked(): boolean {
		return this._revoked;
	}

	public revoke(): void {
		if (this._revoked) {
			return;
		}
		this._revoked = true;
		this.emit("revoke");
	}

	public updatePermission(permission: PlayTokenPermissionLike): void {
		const newToken = this._playToken.update({ permission });
		this._playToken = newToken;
	}
}
