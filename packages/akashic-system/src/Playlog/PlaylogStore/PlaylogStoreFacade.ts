import { PlaylogStoreError } from "./PlaylogStoreError";

import type { Tick } from "@akashic/playlog";
import type { StartPoint } from "@akashic/amflow";
import type { IPlaylogActiveStore, GetTicksQuery, GetStartPointsQuery, ExcludeEventFlags } from "./PlaylogActiveStore/IPlaylogActiveStore";
import type { IPlaylogArchiveStore } from "./PlaylogArchiveStore/IPlaylogArchiveStore";
import type { IPlaylogMetadataStore } from "./PlaylogMetadataStore/IPlaylogMetadataStore";
import type { IPlaylogLock } from "./PlaylogDatabase/IPlaylogLock";
import type { IPlaylogStore } from "./IPlaylogStore";

export type PlaylogStoreFacadeProps = {
	activeStore: IPlaylogActiveStore & IPlaylogArchiveStore;
	archiveStore: IPlaylogArchiveStore;
	metadataStore: IPlaylogMetadataStore;
	lock: IPlaylogLock;
};

export class PlaylogStoreFacade implements IPlaylogStore {
	private readonly activeStore: IPlaylogActiveStore & IPlaylogArchiveStore;
	private readonly archiveStore: IPlaylogArchiveStore;
	private readonly metadataStore: IPlaylogMetadataStore;
	private readonly lock: IPlaylogLock;
	constructor({ activeStore, archiveStore, metadataStore, lock }: PlaylogStoreFacadeProps) {
		this.activeStore = activeStore;
		this.archiveStore = archiveStore;
		this.metadataStore = metadataStore;
		this.lock = lock;
	}

	/**
	 * tickを追記する
	 */
	async putTick(playId: string, tick: Tick, excludeEventFlags?: ExcludeEventFlags): Promise<void> {
		const hasArchive = await this.metadataStore.getHasArchived(playId);
		if (hasArchive) {
			throw new PlaylogStoreError(`アーカイブ作成済みのplay: ${playId}にputTickしようとしました`, playId, "badRequest");
		}
		return await this.activeStore.putTick(playId, tick, excludeEventFlags);
	}

	/**
	 * startPointを追記する
	 */
	async putStartPoint(playId: string, startPoint: StartPoint): Promise<void> {
		const hasArchive = await this.metadataStore.getHasArchived(playId);
		if (hasArchive) {
			throw new PlaylogStoreError(`アーカイブ作成済みのplay: ${playId}にputTickしようとしました`, playId, "badRequest");
		}
		return await this.activeStore.putStartPoint(playId, startPoint);
	}

	/**
	 * 追記済みのtickを更新する
	 */
	async updateTick(playId: string, tick: Tick): Promise<void> {
		const hasArchive = await this.metadataStore.getHasArchived(playId);
		if (hasArchive) {
			// TODO: いったん簡単にするためアーカイブ作成したものは修正出来なくしているが、運用上どのぐらい問題がでるか？
			throw new PlaylogStoreError(`アーカイブ作成済みのplay: ${playId}にupdateTickしようとしました`, playId, "badRequest");
		}
		await this.activeStore.updateTick(playId, tick);
	}

	/**
	 * tickを取得する
	 */
	async getTick(playId: string, frame: number, excludeEventFlags?: ExcludeEventFlags): Promise<Tick | null> {
		const shouldGetFromArchive = await this.metadataStore.shouldGetFromArchive(playId);
		if (shouldGetFromArchive) {
			await this.restore(playId);
		}
		return await this.activeStore.getTick(playId, frame, excludeEventFlags);
	}

	/**
	 * tick一覧を取得する
	 */
	async getTicks(query: GetTicksQuery): Promise<Tick[]> {
		const shouldGetFromArchive = await this.metadataStore.shouldGetFromArchive(query.playId);
		if (shouldGetFromArchive) {
			await this.restore(query.playId);
		}
		return await this.activeStore.getTicks(query);
	}

	/**
	 * tick一覧を取得する(raw版)
	 */
	async getTicksRaw(query: GetTicksQuery): Promise<Buffer[]> {
		const shouldGetFromArchive = await this.metadataStore.shouldGetFromArchive(query.playId);
		if (shouldGetFromArchive) {
			await this.restore(query.playId);
		}
		return await this.activeStore.getTicksRaw(query);
	}

	/**
	 * startPointを取得する
	 */
	async getStartPoint(playId: string, frame: number): Promise<StartPoint | null> {
		const shouldGetFromArchive = await this.metadataStore.shouldGetFromArchive(playId);
		if (shouldGetFromArchive) {
			await this.restore(playId);
		}
		return await this.activeStore.getStartPoint(playId, frame);
	}

	/**
	 * startPoint一覧を取得する
	 */
	async getStartPoints(query: GetStartPointsQuery): Promise<StartPoint[]> {
		const shouldGetFromArchive = await this.metadataStore.shouldGetFromArchive(query.playId);
		if (shouldGetFromArchive) {
			await this.restore(query.playId);
		}
		return await this.activeStore.getStartPoints(query);
	}

	/**
	 * 指定したフレームに一番近いstartPointを取得する
	 */
	async getClosestStartPoint(playId: string, frame: number): Promise<StartPoint | null> {
		const shouldGetFromArchive = await this.metadataStore.shouldGetFromArchive(playId);
		if (shouldGetFromArchive) {
			await this.restore(playId);
		}
		return await this.activeStore.getClosestStartPoint(playId, frame);
	}

	/**
	 * 指定したtimestamp未満の一番近いstartPointを取得する
	 */
	async getClosestStartPointByTimestamp(playId: string, timestamp: number): Promise<StartPoint | null> {
		const shouldGetFromArchive = await this.metadataStore.shouldGetFromArchive(playId);
		if (shouldGetFromArchive) {
			await this.restore(playId);
		}
		return await this.activeStore.getClosestStartPointByTimestamp(playId, timestamp);
	}

	/**
	 * 最終アクセス日時を更新する
	 */
	async updateLastAccessTime(playId: string): Promise<void> {
		await this.metadataStore.updateLastAccessTime(playId);
	}

	/**
	 * アーカイブを作成する
	 */
	async createArchive(playId: string): Promise<void> {
		await this.lock.withPlaylogLock(playId, async () => {
			const hasArchive = await this.metadataStore.getHasArchived(playId);
			if (hasArchive) {
				return;
			}
			const ticks = await this.activeStore.getAllTicks(playId);
			const startPoints = await this.activeStore.getAllStartPoints(playId);
			if (ticks.original.length === 0 || startPoints.length === 0) {
				throw new PlaylogStoreError(`play: ${playId}のアーカイブを作成しようとしましたがデータがありません`, playId, "other");
			}
			await this.archiveStore.store(playId, ticks, startPoints);
			await this.metadataStore.setHasArchived(playId, true);
		});
	}

	/**
	 * アーカイブ作成済みでアクティブにデータが残っているプレイのうち、アクティブの物を消す
	 */
	async pruneActive(playId: string): Promise<void> {
		await this.lock.withPlaylogLock(playId, async () => {
			const shouldGetFromArchive = await this.metadataStore.shouldGetFromArchive(playId);
			if (shouldGetFromArchive) {
				return;
			}
			const hasArchive = await this.metadataStore.getHasArchived(playId);
			if (!hasArchive) {
				throw new PlaylogStoreError(`play: ${playId}のアクティブを掃除しようとしましたが、アーカイブにデータがありません`, playId, "other");
			}
			await this.metadataStore.setShouldGetFromArchive(playId, true);
			await this.activeStore.deleteAll(playId);
		});
	}

	/**
	 * プレイをアーカイブからリストアする
	 */
	private async restore(playId: string): Promise<void> {
		await this.lock.withPlaylogLock(playId, async () => {
			const shouldGetFromArchive = await this.metadataStore.shouldGetFromArchive(playId);
			if (!shouldGetFromArchive) {
				return;
			}
			const ticks = await this.archiveStore.getAllTicks(playId);
			const startPoints = await this.archiveStore.getAllStartPoints(playId);
			if (ticks.original.length === 0 || startPoints.length === 0) {
				throw new PlaylogStoreError(`play: ${playId}のアーカイブをリストアしようとしましたがデータがありません`, playId, "other");
			}
			await this.activeStore.store(playId, ticks, startPoints);
			await this.metadataStore.setShouldGetFromArchive(playId, false);
		});
	}
}
