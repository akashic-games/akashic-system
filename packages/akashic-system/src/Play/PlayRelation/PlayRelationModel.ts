import type { RedisCommander } from "ioredis";
import * as Mysql from "mysql";
import { Database } from "./Database";
import { IPlayTokenPermissionBoundary } from "./IPlayTokenPermissionBoundary";
import { LegacyCacheStore } from "./LegacyCacheStore";

/**
 * プレイの親子関係と、子プレイの認証時に親プレイから引き継ぐ PlayToken Permission
 */
export interface IPlayRelationModel {
	/**
	 * 設定を保存する。
	 * すでに存在する場合は、更新する。
	 *
	 * @return 成功したら True 、失敗したら False
	 */
	store(parentPlayId: string, childPlayId: string, playTokenPermissionBoundary: IPlayTokenPermissionBoundary): Promise<boolean>;

	/**
	 * 子プレイの PlayID で検索する。
	 *
	 * @return Key は 親の Play ID 、 Value は 引き継ぐパーミッションの設定。パーミッションの設定は、何かしらの理由で不明な場合は、 Null になる。
	 */
	findByChild(childPlayId: string): Promise<Map<string, IPlayTokenPermissionBoundary | null>>;

	/**
	 * 設定を削除する。
	 *
	 * @return 成功したら True 、失敗したら False
	 */
	destroy(parentPlayId: string, childPlayId: string): Promise<boolean>;
}

/**
 * 親子関係を始めとする、プレイ間の関連を操作するためのクラス。
 *
 * Strategy パターンにして、キャッシュとかの戦略をブラックボックス化している。
 *
 * ```
 * @startuml
 * class PlayRelation implements IPlayRelationModel
 * package storage {
 *   class CacheStorage implements IPlayRelationModel
 *   class Database implements IPlayRelationModel
 * }
 * namespace servers {
 *   class playlog_server
 *   class system_api_server
 * }
 *
 * servers.playlog_server -> PlayRelation: <use>
 * servers.system_api_server -> PlayRelation: <use>
 *
 * PlayRelation --> CacheStorage
 * PlayRelation --> Database
 * @enduml
 * ```
 */
export class PlayRelationModel implements IPlayRelationModel {
	public static create(redis: RedisCommander, database: Mysql.Pool) {
		return new PlayRelationModel(new Database(database), new LegacyCacheStore(redis));
	}

	private readonly database: IPlayRelationModel;
	private readonly cacheStore: IPlayRelationModel;

	constructor(database: IPlayRelationModel, cacheStore: IPlayRelationModel) {
		this.database = database;
		this.cacheStore = cacheStore;
	}

	/**
	 * キャッシュのみを削除する。
	 * データベースにはノータッチ。
	 *
	 * @inheritDoc
	 */
	public async destroy(parentPlayId: string, childPlayId: string): Promise<boolean> {
		return this.cacheStore.destroy(parentPlayId, childPlayId);
	}

	/**
	 * @inheritDoc
	 */
	public async findByChild(childPlayId: string): Promise<Map<string, IPlayTokenPermissionBoundary | null>> {
		const fromCache = await this.cacheStore.findByChild(childPlayId);
		if (fromCache.size > 0) {
			return fromCache;
		}

		const fromDatabase = await this.database.findByChild(childPlayId);
		if (fromDatabase.size > 0) {
			// cache miss しているので、キャッシュする
			fromDatabase.forEach((boundary, parentPlayId) => {
				if (boundary == null) {
					boundary = {};
				}
				// キャッシュに失敗しても、無視する。
				this.cacheStore.store(parentPlayId, childPlayId, boundary);
			});

			return fromDatabase;
		}

		// もし見つからなかたら、空の Map を返す。
		return new Map<string, IPlayTokenPermissionBoundary | null>();
	}

	/**
	 * @inheritDoc
	 *
	 * 本来なら、更新も受け付けるべきだが、現状は「すでに存在する場合は、保存に失敗する」ようになっている。
	 *
	 * system-api-server 側で HTTP PUT するインターフェースが作成されるときに、実装を正す必要がある。
	 */
	public store(parentPlayId: string, childPlayId: string, playTokenPermissionBoundary: IPlayTokenPermissionBoundary): Promise<boolean> {
		// 重複するようなデータを受け取った場合の挙動について
		// 2018-04-10 現在、
		// database 側は UNIQUE 成約のあるところに INSERT しようとしているので、更新されずに Promise.reject される。
		// cache 側は、 hsetnx ではなく hset を使っているので、更新される。
		return Promise.all([
			this.database.store(parentPlayId, childPlayId, playTokenPermissionBoundary),
			this.cacheStore.store(parentPlayId, childPlayId, playTokenPermissionBoundary),
		]).then(() => true);
	}

	/**
	 * 子プレイの PlayId から親プレイの PlayId を最上位のプレイまで遡って検索する
	 *
	 * 戻り値の配列の順序は以下の通り。
	 * 配列の先頭: 最上位の親プレイの PlayId
	 * 配列の末尾: 直近の親プレイの PlayId
	 *
	 * @param childPlayId 子プレイの PlayId
	 * @return 最上位から直近の親プレイまでの PlayId の配列
	 */
	public async findParentPlayIdsByChild(childPlayId: string): Promise<string[]> {
		if (!childPlayId) {
			// childPlayIdが指定されない時は空配列を返す
			return [];
		}

		const playIds: string[] = [childPlayId];
		let isParentPlayId: boolean = true;
		while (isParentPlayId === true) {
			try {
				const parentPlays: Map<string, IPlayTokenPermissionBoundary | null> = await this.findByChild(playIds[0]);

				if (parentPlays) {
					const parentPlayIds: string[] = Array.from(parentPlays.keys());
					if (parentPlayIds && parentPlayIds.length > 0 && !playIds.includes(parentPlayIds[0])) {
						// 複数の親プレイは現状ないはずだが、複数ある場合は先頭のplayIdを親のplayIdとする
						playIds.unshift(parentPlayIds[0]);
						continue;
					}
				}

				isParentPlayId = false;
			} catch (error) {
				// 親プレイの取得に失敗した場合はそのまま例外を投げる
				throw error;
			}
		}

		// 子プレイのplayId（childPlayId）を削除
		playIds.pop();

		return playIds;
	}
}
