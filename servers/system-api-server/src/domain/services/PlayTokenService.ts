import restCommons = require("@akashic/akashic-rest-commons");
import { PlayToken, PlayTokenLike, SecurityConfig, TokenGenerator, TokenHashLength } from "@akashic/server-engine-data-types";

//
import { RedisCommander } from "ioredis";

/**
 * redis への保存と取得、キャッシュ名の生成なんかを行う
 */
export class PlayTokenService {
	private _redis: RedisCommander;
	private _tokenGenerator: TokenGenerator;

	constructor(redis: RedisCommander, securityConfig: SecurityConfig) {
		this._redis = redis;
		this._tokenGenerator = new TokenGenerator(securityConfig.permissionSecret, TokenHashLength.Length256);
	}

	/**
	 * PlayTokenをredisに保存しそのトークン情報を返す。
	 * 同じキーのものが保存されていた場合CONFLICTを返す。
	 */
	public savePlayToken(playToken: PlayTokenLike): Promise<PlayTokenLike> {
		const cacheName: string = this._createPlayTokenCacheName(playToken.playId, playToken.hash);

		return this._getPlayToken(cacheName).then((token) => {
			if (!token) {
				return this._generatePlayTokenId().then((tokenId) => {
					const saveToken = new PlayToken(playToken, tokenId.toString());
					const expireSec: number = Math.round((playToken.expire.getTime() - Date.now()) / 1000);
					return this._redis.setex(cacheName, expireSec, JSON.stringify(saveToken)).then(() => saveToken);
				});
			} else {
				return Promise.reject(new restCommons.Errors.Conflict(`duplicate playToken. playId:${playToken.playId}`));
			}
		});
	}

	/**
	 * PlayToken を更新する
	 */
	public async updatePlayToken(playToken: PlayTokenLike): Promise<PlayTokenLike> {
		const cacheName: string = this._createPlayTokenCacheName(playToken.playId, playToken.hash);
		const targetToken = await this._getPlayToken(cacheName);
		if (targetToken) {
			const expireSec: number = Math.round((targetToken.expire.getTime() - Date.now()) / 1000);
			const saveToken = new PlayToken(playToken, targetToken.id);
			return this._redis.setex(cacheName, expireSec, JSON.stringify(saveToken)).then(() => saveToken);
		} else {
			return Promise.reject(new restCommons.Errors.NotFound(`playToken not found. playId:${playToken.playId}`));
		}
	}

	/**
	 * playId と token値から、PlayTokenを取得する
	 */
	public getPlayToken(playId: string, tokenValue: string): Promise<PlayTokenLike | null> {
		const tokenHash = this._tokenGenerator.generate(tokenValue);
		const cacheName = this._createPlayTokenCacheName(playId, tokenHash);

		return this._getPlayToken(cacheName);
	}

	/**
	 * PlayTokenのバリデーションを行う
	 */
	public validatePlayToken(playId: string, tokenValue: string): Promise<PlayTokenLike> {
		const tokenHash = this._tokenGenerator.generate(tokenValue);
		const cacheName = this._createPlayTokenCacheName(playId, tokenHash);

		return this._getPlayToken(cacheName).then((playToken) => {
			if (playToken && playToken.expire.getTime() > Date.now()) {
				return playToken;
			} else {
				return null;
			}
		});
	}

	/**
	 * playId と token値から、対象トークンを削除する
	 */
	public deletePlayToken(playId: string, tokenValue: string): Promise<number> {
		const tokenHash = this._tokenGenerator.generate(tokenValue);
		const cacheName = this._createPlayTokenCacheName(playId, tokenHash);

		return this._redis.del(cacheName);
	}

	private _getPlayToken(cacheName: string): Promise<PlayTokenLike | null> {
		return this._redis.get(cacheName).then((result: string) => {
			const cacheData: any = JSON.parse(result);
			if (cacheData) {
				return PlayToken.fromObject(cacheData);
			} else {
				return null;
			}
		});
	}

	/**
	 * キャッシュ名を生成する
	 */
	private _createPlayTokenCacheName(playId: string, tokenHash: string): string {
		return `playtoken_cache_${playId}_${tokenHash}`;
	}

	/**
	 * プレートークンのIDを採番する
	 */
	private _generatePlayTokenId(): Promise<number> {
		return this._redis.incr("playtoken_latest_id");
	}
}
