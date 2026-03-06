import * as AkashicSystem from "@akashic/akashic-system";
import * as Log4js from "log4js";
import { EventLimitCount } from "../EventLimitCount";
import { PlayTokenValidatorConfiguration } from "../PlayTokenValidator";

export interface IServerConfig {
	port: number;
	keyPath?: string;
	certPath?: string;
	reopenTimeout?: number; // クライアント切断時の再接続待ちタイムアウト (msec)
}

export interface IRabbitMQConfig extends AkashicSystem.IRabbitMQConfig {
	prefetchCount: number;
	prefetchInterval: number;
	maxConnectionRetry?: number;
}

/**
 * playlog-server の起動で使用する設定ファイルのスキーマ
 */
export interface IConfigSchema {
	// HTTP Server Spec
	server: IServerConfig;

	// system-api-server client
	playServer: { url: string };
	storageServer: { url: string };

	// middlewares
	dbSettings: AkashicSystem.IDatabaseConfig;
	rabbitmq: IRabbitMQConfig;

	// playlog
	datastore: AkashicSystem.IPlaylogStoreConfig;
	eventLimitCount: EventLimitCount;

	//
	disableClustering: boolean;
	dispatchingRedis: AkashicSystem.IRedisConfig;
	tokenValidator: PlayTokenValidatorConfiguration;

	// logger
	log: Log4js.Configuration;
}
