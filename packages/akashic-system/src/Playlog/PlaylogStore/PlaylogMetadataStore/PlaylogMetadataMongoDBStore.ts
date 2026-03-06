import { PlaylogStoreError } from "../PlaylogStoreError";
import { PlaylogStoreMetadataConflictError } from "../PlaylogStoreMetadataConflictError";

import type { IPlaylogMetadataStore } from "./IPlaylogMetadataStore";
import type { Collection, Db, MongoError } from "mongodb";

export const playlogMetadataCollectionName = "playlogMetadata";
export const lastAccessTimeResolution = 5 * 60 * 1000; // 最終アクセス日時の精度は5分

export type PlaylogMetadata = {
	playId: string;
	revision: number;
	hasArchived: boolean;
	shouldGetFromArchive: boolean;
	lastAccessTime: Date | null;
};

export const defaultMetadata: Readonly<Omit<PlaylogMetadata, "playId">> = {
	revision: 1,
	hasArchived: false,
	shouldGetFromArchive: false,
	lastAccessTime: null,
};

export class PlaylogMetadataMongoDBStore implements IPlaylogMetadataStore {
	private readonly maxRetryCount = 3;
	protected readonly metadataCollection: Collection<PlaylogMetadata>;

	constructor(db: Db) {
		this.metadataCollection = db.collection(playlogMetadataCollectionName);
	}

	/**
	 * プレイがアーカイブ化されて、かつmongoDBStoreから消されているかどうかを取得する
	 */
	async shouldGetFromArchive(playId: string): Promise<boolean> {
		const metadata = await this.getPlaylogMetadata(playId);
		return metadata.shouldGetFromArchive;
	}

	/**
	 * プレイがアーカイブ化されて、かつmongoDBStoreから消されているかどうかを設定する
	 */
	async setShouldGetFromArchive(playId: string, shouldGetFromArchive: boolean): Promise<void> {
		await this.setPlaylogMetadata(playId, async (metadata) => {
			metadata.shouldGetFromArchive = shouldGetFromArchive;
			return metadata;
		});
	}

	/**
	 * プレイのアーカイブが作成されているかどうかを取得する
	 */
	async getHasArchived(playId: string): Promise<boolean> {
		const metadata = await this.getPlaylogMetadata(playId);
		return metadata.hasArchived;
	}

	/**
	 * プレイのアーカイブが作成されているかどうかを設定する
	 */
	async setHasArchived(playId: string, hasArchive: boolean): Promise<void> {
		await this.setPlaylogMetadata(playId, async (metadata) => {
			metadata.hasArchived = hasArchive;
			return metadata;
		});
	}

	/**
	 * 最終アクセス日時を更新する
	 */
	async updateLastAccessTime(playId: string): Promise<void> {
		await this.setPlaylogMetadata(playId, async (metadata) => {
			const newLastAccessTime = this.getNow();

			// 更新後のlastAccessTimeが現在値と大して変わらなければ更新しない(updateLastAccessTimeは頻繁に呼ばれるが、そこまでの精度は要求しないので、楽観ロックが失敗する可能性がある処理を避けるために制度を落とす)
			if (metadata.lastAccessTime && Math.abs(newLastAccessTime.getTime() - metadata.lastAccessTime.getTime()) < lastAccessTimeResolution) {
				return null;
			}

			metadata.lastAccessTime = newLastAccessTime;
			return metadata;
		});
	}

	/**
	 * プレイログのメタデータ取得
	 */
	protected async getPlaylogMetadata(playId: string): Promise<PlaylogMetadata> {
		let metadata: PlaylogMetadata | null;
		try {
			metadata = await this.metadataCollection.findOne({ playId });
		} catch (e) {
			throw new PlaylogStoreError(`playId: ${playId} のplaylogMetadataの取得に失敗しました`, playId, "other", e as Error);
		}
		if (metadata) {
			return metadata;
		}
		return { playId, ...defaultMetadata };
	}

	/**
	 * プレイログのメタデータ更新
	 */
	protected async setPlaylogMetadata(
		playId: string,
		updateFunc: (metadata: PlaylogMetadata) => Promise<PlaylogMetadata | null>,
	): Promise<void> {
		let retry = 0;
		let lastError: Error | null = null;
		for (retry = 0; retry < this.maxRetryCount; ++retry) {
			const metadata = await this.getPlaylogMetadata(playId);

			const metadataUpdated = await updateFunc(metadata);
			if (metadataUpdated === null) {
				// 更新後のmetadataがnullの場合は更新しない
				return;
			}

			const currentRevision = metadataUpdated.revision;
			++metadataUpdated.revision;

			try {
				await this.metadataCollection.updateOne(
					{ playId: metadata.playId, revision: currentRevision },
					{ $set: metadataUpdated },
					{ upsert: true },
				);

				lastError = null;
				break;
			} catch (error) {
				const err = error as MongoError;
				// 楽観ロックに失敗すると、MongoDBはE11000 duplicate key errorを飛ばす
				if (err.code === 11000) {
					// エラーを記録してリトライ
					lastError = err;
					continue;
				}
				// それ以外は通常のエラーを投げる
				throw new PlaylogStoreError(`playId: ${metadata.playId} のplaylogMetadataの更新に失敗しました`, metadata.playId, "other", err);
			}
		}

		if (retry >= this.maxRetryCount && lastError !== null) {
			throw new PlaylogStoreMetadataConflictError(`playId: ${playId} のplaylogMetadataの更新が競合しました`, playId, lastError);
		}
	}

	/**
	 * テスト時に getNow() を上書きしてコントロールできるようにしてある
	 */
	protected getNow(): Date {
		return new Date();
	}
}
