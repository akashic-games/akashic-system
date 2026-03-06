import * as AkashicSystem from "@akashic/akashic-system";
import { Session } from "@akashic/playlog-server-engine";
import { PlayToken as PlayTokenAMQP } from "@akashic/playtoken-amqp";
import {
	PlayToken,
	PlayTokenPermission,
	PlayTokenPermissionLike,
	TokenGenerator,
	TokenHashLength,
} from "@akashic/server-engine-data-types";
import { PermissionServerClient } from "@akashic/system-control-api-client";
import { EventEmitter } from "events";
import log4js from "log4js";
import * as uuid from "node-uuid";
import { PlayTokenEventConsumer } from "./PlayTokenEventConsumer";
import { PlayTokenHolder } from "./PlayTokenHolder";
import { PlayTokenStore } from "./PlayTokenStore";

//
import { default as Redis, Cluster as RedisCluster, RedisCommander } from "ioredis";
import { default as nodeConfig } from "config";

const logger = log4js.getLogger("out");

export interface PlayTokenValidatorConfiguration {
	type: "redis" | "permissionServer";
	redis?: {
		repository: unknown;
		secret: string;
	};
	permissionServer?: {
		url: string;
	};
	database?: AkashicSystem.IDatabaseConfig;
}

interface ParentPlayInfo {
	token: PlayToken; // 認証済みの親プレイ token
	permission: PlayTokenPermissionLike; // 子に設定するパーミッション
}

export class PlayTokenValidator extends EventEmitter {
	private _redisRepository: RedisCommander;
	private _playlogRelationModel: AkashicSystem.PlayRelationModel | null;

	private _permissionClient: PermissionServerClient;
	private _tokenGenerator: TokenGenerator;
	private _tokenStore: PlayTokenStore;
	private _sessions: Set<string>;

	constructor(config: PlayTokenValidatorConfiguration, playTokenEventConsumer: PlayTokenEventConsumer) {
		super();
		this._redisRepository = null;
		this._permissionClient = null;
		this._tokenGenerator = null;
		if (config.type === "redis") {
			this._redisRepository = nodeConfig.has("dispatchingRedis.hosts") // is cluster?
				? new RedisCluster(nodeConfig.get("dispatchingRedis.hosts"), nodeConfig.get("dispatchingRedis.option"))
				: new Redis(
						nodeConfig.get("dispatchingRedis.port"),
						nodeConfig.get("dispatchingRedis.host"),
						nodeConfig.get("dispatchingRedis.option"),
					);

			this._tokenGenerator = new TokenGenerator(config.redis.secret, TokenHashLength.Length256);

			this._playlogRelationModel = new AkashicSystem.PlayRelationModel(
				AkashicSystem.Database.fromConfig(config.database),
				new AkashicSystem.LegacyCacheStore(this._redisRepository),
			);
		} else if (config.type === "permissionServer") {
			this._permissionClient = new PermissionServerClient(config.permissionServer.url);
		} else {
			throw new Error("invalid token validator configuration.");
		}
		this._tokenStore = new PlayTokenStore();
		this._sessions = new Set();
		playTokenEventConsumer.on("revoke", (revokeReq: PlayTokenAMQP, ack: (err?: any) => void) =>
			this._onRevokePlayTokenEvent(revokeReq, ack),
		);
		playTokenEventConsumer.on("updatePermission", (updateReq: PlayTokenAMQP, ack: (err?: any) => void) =>
			this._onUpdatePermissionEvent(updateReq, ack),
		);
	}

	public validate(session: Session, playId: string, value: string): Promise<PlayTokenHolder> {
		if (!this._sessions.has(session.id)) {
			// 新規セッション
			this._sessions.add(session.id);
			session.once("close", () => {
				const tokens = this._tokenStore.deleteBySession(session.id);
				this._sessions.delete(session.id);
			});
		}

		return this._validate(session, playId, value).then((holder) => {
			this._tokenStore.add(holder);
			this.emit("validated", session, playId, holder.playToken);
			return holder;
		});
	}

	public peekToken(playId: string, value: string): Promise<PlayToken | null> {
		return this._redisRepository.get(this._getTokenKey(playId, value)).then((data) => {
			try {
				return PlayToken.fromObject(JSON.parse(data));
			} catch (err) {
				return null;
			}
		});
	}

	private _validate(session: Session, playId: string, value: string): Promise<PlayTokenHolder> {
		if (value) {
			// token value が指定されていたらまずその token で検証
			return this._validateByTokenValue(session.id, playId, value).catch((err) => {
				// 検証失敗したらセッション内の親プレイに基く認証をする
				return this._validateBySession(session.id, playId);
			});
		} else {
			// 検証失敗したらセッション内の親プレイに基く認証をする
			return this._validateBySession(session.id, playId);
		}
	}

	private _validateBySession(sessionId: string, playId: string): Promise<PlayTokenHolder> {
		return this._getParentPlayInfo(sessionId, playId).then((parents) => {
			if (!parents.length) {
				// 該当する親 play が存在しない場合は認証失敗
				return Promise.reject<PlayTokenHolder>(new Error("failed to authenticate."));
			}
			// TODO: 該当する play が複数ある場合にどうするかは要検討
			//       現状は、最初に見つかったものを継承する(親は 1 個のはず、という想定)
			const parentToken = parents[0].token;
			const permission = parents[0].permission;
			const token = new PlayToken({
				id: uuid.v4(),
				playId,
				value: parentToken.value,
				hash: parentToken.hash,
				expire: parentToken.expire,
				permission,
				meta: parentToken.meta,
			});
			return Promise.resolve(new PlayTokenHolder(token, sessionId, parentToken.id));
		});
	}

	private _validateByTokenValue(sessionId: string, playId: string, value: string): Promise<PlayTokenHolder> {
		let getToken: Promise<PlayToken>;
		if (this._redisRepository) {
			getToken = this._getTokenFromRedis(playId, value);
		} else {
			getToken = this._getTokenFromPermissionServer(playId, value);
		}
		return getToken.then((token) => {
			if (token && token.expire.getTime() >= Date.now()) {
				return new PlayTokenHolder(token, sessionId);
			} else {
				return Promise.reject<PlayTokenHolder>(new Error("failed to authenticate."));
			}
		});
	}

	private _getTokenFromRedis(playId: string, value: string): Promise<PlayToken> {
		const cacheName = this._getTokenKey(playId, value);
		let result: PlayToken = null;
		return this._redisRepository
			.get(cacheName)
			.then((data) => {
				try {
					result = PlayToken.fromObject(JSON.parse(data));
				} catch (err) {
					result = null;
				}
				if (result) {
					return this._redisRepository.del(cacheName);
				}
			})
			.then(() => result);
	}

	private _getTokenFromPermissionServer(playId: string, value: string): Promise<PlayToken> {
		return this._permissionClient.validateToken({ playId, value }).then((res) => res.data);
	}

	// セッション内の認証済み親プレイと引き継いだパーミッションを返す
	private _getParentPlayInfo(sessionId: string, playId: string): Promise<ParentPlayInfo[]> {
		if (!this._redisRepository) {
			return Promise.resolve([]);
		}

		return this._playlogRelationModel
			.findByChild(playId)
			.then((parentPlays: Map<string, AkashicSystem.IPlayTokenPermissionBoundary | null>) => {
				// 同一セッションでトークンを使って認証済みのトークン情報を取得
				const authedTokens = this._tokenStore.getBySession(sessionId).filter((token) => {
					// parentId が設定されているものは親子関係を使って認証されたものなので除外
					return !token.revoked && token.parentId == null;
				});
				if (!authedTokens.length) {
					return [];
				}

				const result: ParentPlayInfo[] = [];
				parentPlays.forEach((cond, parentId) => {
					const authorizedFlagName = typeof cond.authorizedFlag === "string" ? cond.authorizedFlag : undefined;

					// 同一セッションで認証済のものから設定されている親プレイと一致するものを探す
					authedTokens.forEach((token) => {
						// 子プレーに authorizedFlag が設定されている場合はトークンの meta 情報をチェックする
						if (authorizedFlagName != null) {
							const authorizedFlag = token.playToken.meta[authorizedFlagName];
							if (typeof authorizedFlag !== "boolean" || authorizedFlag === false) {
								return; // authorizedFlag が設定されていないトークンはスキップ
							}
						}
						if (token.playToken.playId === parentId) {
							const childPlayPermission =
								cond == null ? token.playToken.permission : this._getChildPermission(token.playToken.permission, cond.allow, cond.deny);

							result.push({ token: token.playToken, permission: childPlayPermission });
						}
					});
				});
				return result;
			});
	}

	private _getChildPermission(
		parentPermission: PlayTokenPermissionLike,
		allow: PlayTokenPermissionLike,
		deny: PlayTokenPermissionLike,
	): PlayTokenPermissionLike {
		// 認証済み親プレイのパーミッションを基本にする
		const permission: PlayTokenPermissionLike = {
			writeTick: parentPermission.writeTick,
			readTick: parentPermission.readTick,
			subscribeTick: parentPermission.subscribeTick,
			sendEvent: parentPermission.sendEvent,
			subscribeEvent: parentPermission.subscribeEvent,
			maxEventPriority: parentPermission.maxEventPriority,
		};
		// allow を適用
		if (allow) {
			permission.writeTick = permission.writeTick || Boolean(allow.writeTick);
			permission.readTick = permission.readTick || Boolean(allow.readTick);
			permission.subscribeTick = permission.subscribeTick || Boolean(allow.subscribeTick);
			permission.sendEvent = permission.sendEvent || Boolean(allow.sendEvent);
			permission.subscribeEvent = permission.subscribeEvent || Boolean(allow.subscribeEvent);
			permission.maxEventPriority = Math.max(permission.maxEventPriority, allow.maxEventPriority);
		}
		// deny を適用
		if (deny) {
			permission.writeTick = permission.writeTick && !Boolean(deny.writeTick);
			permission.readTick = permission.readTick && !Boolean(deny.readTick);
			permission.subscribeTick = permission.subscribeTick && !Boolean(deny.subscribeTick);
			permission.sendEvent = permission.sendEvent && !Boolean(deny.sendEvent);
			permission.subscribeEvent = permission.subscribeEvent && !Boolean(deny.subscribeEvent);
			permission.maxEventPriority = Math.min(permission.maxEventPriority, deny.maxEventPriority);
		}
		return permission;
	}

	private _getTokenKey(playId: string, value: string): string {
		const hash = this._tokenGenerator.generate(value);
		return `playtoken_cache_${playId}_${hash}`;
	}

	private _onRevokePlayTokenEvent(revokeReq: PlayTokenAMQP, ack: (err?: any) => void): void {
		logger.info(
			`Received event that play token revoked. playId:${revokeReq.playId}, userId:${revokeReq.userId}, tokenId:${revokeReq.userId}`,
		);
		this._updatePlayTokenByEvent(revokeReq, (holder: PlayTokenHolder) => this._revokePlayToken(holder));
		ack();
	}

	private _onUpdatePermissionEvent(updateReq: PlayTokenAMQP, ack: (err?: any) => void): void {
		if (updateReq.permission) {
			logger.info(
				`Received event that permission updated. permission:${updateReq.permission}, playId:${updateReq.playId}, userId:${updateReq.userId}`,
			);
			this._updatePlayTokenByEvent(updateReq, (holder: PlayTokenHolder) => this._updatePermission(holder, updateReq.permission));
		}
		ack();
	}

	/**
	 * プレートークンイベントからの更新
	 *
	 * パターン:
	 *
	 * # １つ
	 * tokenId: 特定したtokenを更新
	 * playId: playId下にある、全トークンを更新
	 * userId: meta.userIdが一致する全トークンを更新
	 *
	 * # ２つ
	 * tokenId & playId: tokenId で、特定し、playId が一緒なら更新
	 * tokenId & userId: tokenId で、特定し、meta.userId が一緒なら更新
	 * playId & userId: playIds下にある、meta.userId が一致するトークンを取得し、更新
	 *
	 * # ３つ
	 * tokenId & playId & userId: tokenId で、特定し、playId & userId が一致すれば 更新
	 *
	 * TODO: meta情報での更新を可能にする
	 */
	private _updatePlayTokenByEvent(req: PlayTokenAMQP, updateToken: (holder: PlayTokenHolder) => void): void {
		// tokenId があるパターン
		if (req.id) {
			const holder = this._tokenStore.get(req.id);
			if (holder) {
				const playId = holder.playToken.playId;
				const userId = holder.playToken.meta ? holder.playToken.meta.userId : undefined;
				// 両方
				if (req.playId && req.userId) {
					if (playId === req.playId && userId === req.userId) {
						updateToken(holder);
					}
				} else if (req.playId && !req.userId) {
					// playId のみ
					if (playId === req.playId) {
						updateToken(holder);
					}
				} else if (!req.playId && req.userId) {
					// userId のみ
					if (userId === req.userId) {
						updateToken(holder);
					}
				} else {
					// tokenId のみ
					updateToken(holder);
				}
			}
		} else {
			// playId もしくは userId がある
			if (req.playId) {
				const holders = this._tokenStore.getByPlay(req.playId);
				if (req.userId) {
					// playId && userId
					holders.forEach((holder) => {
						const userId = holder.playToken.meta ? holder.playToken.meta.userId : undefined;
						if (userId === req.userId) {
							updateToken(holder);
						}
					});
				} else {
					// playId のみ
					holders.forEach((holder) => {
						updateToken(holder);
					});
				}
			} else if (req.userId) {
				// userId のみ
				const holders = this._tokenStore.getByUser(req.userId);
				holders.forEach((holder) => {
					updateToken(holder);
				});
			}
		}
	}

	// 親子関係で認証された子の token も含めて revoke する
	private _revokePlayToken(holder: PlayTokenHolder, visited?: Set<string>): void {
		const id = holder.playToken.id;
		// 循環検知用
		if (!visited) {
			visited = new Set();
		}
		if (visited.has(id)) {
			return;
		}

		holder.revoke();
		logger.info("Revoked token:", id);

		visited.add(id);
		const children = this._tokenStore.getByParent(id);
		children.forEach((child) => {
			setImmediate(() => {
				this._revokePlayToken(child, visited);
			});
		});
	}

	// 親子関係で認証された子の token も含めて permission を更新する
	private _updatePermission(holder: PlayTokenHolder, permission: PlayTokenPermissionLike, visited?: Set<string>): void {
		const id = holder.playToken.id;
		// 循環検知用
		if (!visited) {
			visited = new Set();
		}
		if (visited.has(id)) {
			return;
		}

		holder.updatePermission(permission);
		logger.info("Update permission:", id, permission);

		visited.add(id);
		const children = this._tokenStore.getByParent(id);
		children.forEach((child) => {
			setImmediate(() => {
				this._updatePermission(child, permission, visited);
			});
		});
	}
}
