import { S3Client, S3ClientConfig } from "@aws-sdk/client-s3";
import * as mongodb from "mongodb";
import { PlaylogStoreFacade, MongoDBStore, PlaylogMetadataMongoDBStore, PlaylogS3Store, PlaylogDatabase } from "@akashic/akashic-system";
import type { PlaylogS3StoreSettings, IPlaylogStore } from "@akashic/akashic-system";

import type { Pool } from "mysql";

export interface PlaylogStoreConfig {
	backend: string;
	mongodb?: {
		url: string;
	};
}

export type PlaylogStoreConnectionConfig = {
	playlogStore: PlaylogStoreConfig;
	s3: Omit<S3ClientConfig, "credential"> & { accessKeyId?: string; secretAccessKey?: string };
	archiveSettings: PlaylogS3StoreSettings;
};

export class PlaylogStoreConnection {
	private _config: PlaylogStoreConnectionConfig;
	private _mysqlPool: Pool;
	private _playlogStoreFacade: PlaylogStoreFacade | null = null;
	private _mongoDBStore: MongoDBStore | null = null;
	private _metadataMongoDBStore: PlaylogMetadataMongoDBStore | null = null;
	private _mongoClient: mongodb.MongoClient | null = null;
	private _connected: boolean;

	constructor(config: PlaylogStoreConnectionConfig, mysqlPool: Pool) {
		this._config = config;
		this._mysqlPool = mysqlPool;
		this._connected = false;
	}

	public async connect(): Promise<void> {
		if (this._connected) {
			return;
		}
		if (this._config.playlogStore.backend !== "mongodb") {
			throw new Error("unknown backend type: " + this._config.playlogStore.backend);
		}
		await this._connectMongo(this._config.playlogStore.mongodb.url);
		this.buildStore();
		this._connected = true;
	}

	public async disconnect(): Promise<void> {
		if (!this._connected) {
			return;
		}
		if (this._mongoClient) {
			return this._disconnectMongo();
		}
		this._playlogStoreFacade = null;
	}

	public getPlaylogStore(): IPlaylogStore {
		if (!this._playlogStoreFacade) {
			throw new Error("connectで初期化していません");
		}
		return this._playlogStoreFacade;
	}

	private async _connectMongo(url: string): Promise<void> {
		const client = await mongodb.MongoClient.connect(url);
		this._mongoClient = client;
		this._mongoDBStore = new MongoDBStore(client.db());
		this._metadataMongoDBStore = new PlaylogMetadataMongoDBStore(client.db());
	}

	private buildStore(): void {
		const { accessKeyId, secretAccessKey, ...rest } = this._config.s3;
		const s3 = new S3Client({
			credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
			region: "ap-northeast-1",
			...rest,
		});
		const archiveStore = new PlaylogS3Store(s3, this._config.archiveSettings);
		const playlogDatabase = new PlaylogDatabase(this._mysqlPool!);
		this._playlogStoreFacade = new PlaylogStoreFacade({
			activeStore: this._mongoDBStore!,
			archiveStore,
			metadataStore: this._metadataMongoDBStore!,
			lock: playlogDatabase,
		});
	}

	private async _disconnectMongo(): Promise<void> {
		await this._mongoClient!.close(true);
		this._mongoClient = null;
		this._mongoDBStore = null;
		this._metadataMongoDBStore = null;
		this._connected = false;
	}
}
