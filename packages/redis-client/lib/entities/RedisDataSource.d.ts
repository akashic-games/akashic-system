/// <reference types="node" />
export interface RedisDataSource {
    host: string;
    port: number;
    option?: RedisOption;
}
export interface RedisOption {
    family?: number;
    path?: string;
    keepAlive?: number;
    connectionName?: string;
    password?: string;
    db?: number;
    enableReadyCheck?: boolean;
    keyPrefix?: string;
    retryStrategy?: (times: number) => number;
    reconnectOnError?: (error: Error) => boolean;
    enableOfflineQueue?: boolean;
    connectTimeout?: number;
    autoResubscribe?: boolean;
    autoResendUnfulfilledCommands?: boolean;
    lazyConnect?: boolean;
    tls?: {
        ca: Buffer;
    };
    sentinels?: Array<{
        host: string;
        port: number;
    }>;
    name?: string;
    readOnly?: boolean;
    dropBufferSupport?: boolean;
}
export interface RedisClusterHost {
    host: string;
    port: number;
}
export interface RedisClusterDataSource {
    hosts: RedisClusterHost[];
    option?: RedisClusterOption;
}
export interface RedisClusterOption {
    clusterRetryStrategy?: (number: number) => number;
    enableOfflineQueue?: boolean;
    enableReadyCheck?: boolean;
    scaleReads?: string;
    maxRedirections?: number;
    retryDelayOnFailover?: number;
    retryDelayOnClusterDown?: number;
    retryDelayOnTryAgain?: number;
    slotsRefreshTimeout?: number;
    redisOptions?: RedisOption;
}
export declare function isRedisDataSource(obj: any): boolean;
export declare function isRedisClusterDataSource(obj: any): boolean;
