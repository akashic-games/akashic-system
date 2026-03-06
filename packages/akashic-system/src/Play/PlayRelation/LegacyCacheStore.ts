import type { RedisCommander } from "ioredis";
import { IPlayTokenPermissionBoundary } from "./IPlayTokenPermissionBoundary";
import { IPlayRelationModel } from "./PlayRelationModel";

export class LegacyCacheStore implements IPlayRelationModel {
	public static getKeyName(childId: string): string {
		return LegacyCacheStore.KEY_NAME_PREFIX + childId;
	}

	private static KEY_NAME_PREFIX: string = "akashic:parent_plays:";

	private client: RedisCommander;

	constructor(client: RedisCommander) {
		this.client = client;
	}

	public destroy(parentPlayId: string, childPlayId: string): Promise<boolean> {
		return this.client.hdel(LegacyCacheStore.getKeyName(childPlayId), parentPlayId).then(() => true);
	}

	public async findByChild(childPlayId: string): Promise<Map<string, IPlayTokenPermissionBoundary | null>> {
		const jsonStrings = await this.client.hgetall(LegacyCacheStore.getKeyName(childPlayId));

		const playTokenPermissionBoundaries = new Map<string, IPlayTokenPermissionBoundary | null>();
		Object.keys(jsonStrings).forEach((parentPlayIds) => {
			let boundary: IPlayTokenPermissionBoundary | null = null;
			try {
				boundary = JSON.parse(jsonStrings[parentPlayIds]);
			} catch (e) {
				// nothing
			}
			playTokenPermissionBoundaries.set(parentPlayIds, boundary);
		});

		return playTokenPermissionBoundaries;
	}

	public async store(
		parentPlayId: string,
		childPlayId: string,
		playTokenPermissionBoundary: IPlayTokenPermissionBoundary,
	): Promise<boolean> {
		const keyName = LegacyCacheStore.getKeyName(childPlayId);

		await this.client.hset(keyName, parentPlayId, JSON.stringify(playTokenPermissionBoundary));
		// hsetnx ではないので、 keyName のレコードは必ず存在する
		await this.client.expire(keyName, 60 * 10); // 10分

		return true;
	}
}
