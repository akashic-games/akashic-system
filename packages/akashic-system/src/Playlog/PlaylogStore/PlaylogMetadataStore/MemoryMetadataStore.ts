import { defaultMetadata } from "./PlaylogMetadataMongoDBStore";
import type { IPlaylogMetadataStore } from "./IPlaylogMetadataStore";
import type { PlaylogMetadata } from "./PlaylogMetadataMongoDBStore";

export class MemoryMetadataStore implements IPlaylogMetadataStore {
	readonly metadata = new Map<string, PlaylogMetadata>();
	reset() {
		this.metadata.clear();
	}

	async shouldGetFromArchive(playId: string): Promise<boolean> {
		return this.getMetadata(playId).shouldGetFromArchive;
	}
	async setShouldGetFromArchive(playId: string, shouldGetFromArchive: boolean): Promise<void> {
		this.getMetadata(playId).shouldGetFromArchive = shouldGetFromArchive;
		++this.getMetadata(playId).revision;
	}
	async getHasArchived(playId: string): Promise<boolean> {
		return this.getMetadata(playId).hasArchived;
	}
	async setHasArchived(playId: string, hasArchive: boolean): Promise<void> {
		this.getMetadata(playId).hasArchived = hasArchive;
		++this.getMetadata(playId).revision;
	}
	async updateLastAccessTime(playId: string): Promise<void> {
		this.getMetadata(playId).lastAccessTime = new Date();
		++this.getMetadata(playId).revision;
	}
	private getMetadata(playId: string): PlaylogMetadata {
		const data = this.metadata.get(playId);
		if (data) {
			return data;
		}
		const newData = { playId, ...defaultMetadata };
		this.metadata.set(playId, newData);
		return newData;
	}
}
