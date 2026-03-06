import { PlayTokenHolder } from "./PlayTokenHolder";

/**
 * 認証済み PlayToken を保持しておくクラス
 */
export class PlayTokenStore {
	private _tokens: { [tokenId: string]: PlayTokenHolder };
	private _tokensSessionMap: { [sessionId: string]: Set<string> };
	private _tokensParentMap: { [parentPlayId: string]: Set<string> };
	private _tokensPlayMap: { [playId: string]: Set<string> };
	private _tokensUserMap: { [userId: string]: Set<string> };

	constructor() {
		this._tokens = {};
		this._tokensSessionMap = {};
		this._tokensParentMap = {};
		this._tokensPlayMap = {};
		this._tokensUserMap = {};
	}

	public add(holder: PlayTokenHolder): void {
		if (this._tokens[holder.playToken.id]) {
			return;
		}

		const id = holder.playToken.id;
		const sessionId = holder.sessionId;
		const parentId = holder.parentId;
		const playId = holder.playToken.playId;
		const userId = holder.playToken.meta ? holder.playToken.meta.userId : null;

		this._tokens[id] = holder;
		this._add(this._tokensSessionMap, sessionId, id);
		this._add(this._tokensParentMap, parentId, id);
		this._add(this._tokensPlayMap, playId, id);
		this._add(this._tokensUserMap, userId, id);
	}

	public delete(id: string): void {
		const holder = this._tokens[id];
		if (!holder) {
			return;
		}

		const sessionId = holder.sessionId;
		const parentId = holder.parentId;
		const playId = holder.playToken.playId;
		const userId = holder.playToken.meta ? holder.playToken.meta.userId : null;

		delete this._tokens[id];
		this._delete(this._tokensSessionMap, sessionId, id);
		this._delete(this._tokensParentMap, parentId, id);
		this._delete(this._tokensPlayMap, playId, id);
		this._delete(this._tokensUserMap, userId, id);
	}

	public deleteBySession(sessionId: string): void {
		if (!this._tokensSessionMap[sessionId]) {
			return;
		}
		const ids = Array.from(this._tokensSessionMap[sessionId]);
		ids.forEach((id) => {
			this.delete(id);
		});
	}

	public count(): number {
		return Object.keys(this._tokens).length;
	}

	public clear(): void {
		const ids = Object.keys(this._tokens);
		ids.forEach((id) => {
			this.delete(id);
		});
	}

	public get(id: string): PlayTokenHolder {
		return this._tokens[id];
	}

	public getBySession(sessionId: string): PlayTokenHolder[] {
		return this._get(this._tokensSessionMap, sessionId);
	}

	public getByParent(parentId: string): PlayTokenHolder[] {
		return this._get(this._tokensParentMap, parentId);
	}

	public getByPlay(playId: string): PlayTokenHolder[] {
		return this._get(this._tokensPlayMap, playId);
	}

	public getByUser(userId: string): PlayTokenHolder[] {
		return this._get(this._tokensUserMap, userId);
	}

	private _add(tokensMap: { [id: string]: Set<string> }, key: string, tokenId: string): void {
		if (!key) {
			return;
		}
		if (!tokensMap[key]) {
			tokensMap[key] = new Set();
		}
		tokensMap[key].add(tokenId);
	}

	private _delete(tokensMap: { [id: string]: Set<string> }, key: string, tokenId: string): void {
		if (!key) {
			return;
		}
		const tokenIds = tokensMap[key];
		if (!tokenIds) {
			return;
		}
		tokenIds.delete(tokenId);
		if (!tokenIds.size) {
			delete tokensMap[key];
		}
	}

	private _get(tokensMap: { [id: string]: Set<string> }, key: string): PlayTokenHolder[] {
		const result: PlayTokenHolder[] = [];
		if (!key) {
			return result;
		}
		const tokenIds = tokensMap[key];
		if (!tokenIds) {
			return result;
		}
		tokenIds.forEach((id) => {
			result.push(this._tokens[id]);
		});
		return result;
	}
}
