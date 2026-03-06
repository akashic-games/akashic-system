import { RedisClusterDataSource, RedisDataSource } from "../entities/RedisDataSource";
/**
 * Redis リポジトリ
 * - 各操作開始時に未接続時は内部で接続を試みる。connect() は明示的に呼び出さなくても良い。
 */
export declare class RedisRepository {
    readonly isCluster: boolean;
    private _dataSource;
    /**
     * Redis Server へのコネクション。
     * Redis Server へ接続していない場合は、 `undefined` になる。
     */
    private _client;
    private _errorHandler;
    constructor(dataSource: RedisDataSource | RedisClusterDataSource, errorHandler?: (error: any) => void);
    connect(): void;
    disconnect(): void;
    connected(): boolean;
    zIncrBy(key: string, increment: number, member: string): Promise<number>;
    /**
     * ZRANGEBYSCORE
     * @note
     * 本操作は condition.withScores 引数にかかわらずフラットな文字列配列を返す。
     * - withScores:false => ["m1", "m2", "m3"]
     * - withScores:true  => ["m1", "1", "m2", "2", "m3", "3"]
     * 後者を member: string, score: number で再配列するのはコストが発生するため、呼び出し側で行うこと。
     * - e.g. RedisUtil.toMemberWithScore(zRevRangeByScoreList); // => {member, score}[]
     */
    zRangeByScore(key: string, condition: {
        min?: number;
        max?: number;
        withScores?: boolean;
        limit?: {
            offset: number;
            count: number;
        };
    }, reversed?: boolean): Promise<string[]>;
    zRevRangeByScore(key: string, condition: {
        min?: number;
        max?: number;
        withScores?: boolean;
        limit?: {
            offset: number;
            count: number;
        };
    }): Promise<string[]>;
    zAdd(key: string, score: number, member: string): Promise<number>;
    zRem(key: string, member: string): Promise<number>;
    set(key: string, value: string): Promise<string>;
    setex(key: string, value: string, expireSecond: number): Promise<string>;
    setnx(key: string, value: string): Promise<number>;
    get(key: string): Promise<string>;
    del(key: string): Promise<number>;
    incr(key: string): Promise<number>;
    incrBy(key: string, value: number): Promise<number>;
    decr(key: string): Promise<number>;
    decrBy(key: string, value: number): Promise<number>;
    /**
     * key のリストの先頭にstring型のvalueをpushし、要素数を返します
     */
    lpush(key: string, value: string): Promise<number>;
    /**
     * key のリストの末尾にstring型のvalueをpushし、要素数を返します
     */
    rpush(key: string, value: string): Promise<number>;
    /**
     * key のリストの先頭から要素を取得し、その要素をリストから削除します
     */
    lpop(key: string): Promise<string>;
    /**
     * key のリストの末尾から要素を取得し、その要素をリストから削除します
     */
    rpop(key: string): Promise<string>;
    /**
     * key のリストから、start, end の範囲にある要素を配列で返します。
     * start, end ともに 0 を指定すると、先頭の１要素だけを返します。
     */
    lrange(key: string, start: number, end: number): Promise<string[]>;
    /**
     * key のリストから、count個数分だけ、value に一致する値を削除し
     * 削除された要素数を返します。
     * count に 0を指定すると、すべての一致する要素を削除します。
     * 負数を指定すると、末尾から削除していきます。
     */
    lrem(key: string, count: number, value: string): Promise<number>;
    /**
     * セット型 key に members を追加します。
     *
     * members は、配列でも、可変長引数でも、渡すことができます。
     *
     * @see https://redis.io/commands/sadd
     * @param key
     * @param members
     * @return {Promise}
     */
    sadd(key: string, ...members: any[]): Promise<number>;
    /**
     * セット型 key に存在する member の一覧を返します。
     *
     * @see https://redis.io/commands/smembers
     * @param keys
     * @return {Promise}  Promise<string[]> 。 `sadd` では数値だったとしても、 Redis は常に文字列で返す。
     *
     */
    smembers(keys: string): Promise<string[]>;
    /**
     * セット型 key から members を削除します。
     *
     * members は、配列でも、可変長引数でも、渡すことができます。
     *
     * @see https://redis.io/commands/srem
     * @param key
     * @param members
     * @return {Promise}
     */
    srem(key: string, ...members: any[]): Promise<number>;
    /**
     * セット型 key に member が存在するかを返します。
     *
     * @see https://redis.io/commands/sismember
     * @param key
     * @param member
     * @return {Promise}
     */
    sismember(key: string, member: string | number): Promise<boolean>;
    /**
     * ハッシュ型 key へ、 field を追加します。
     *
     * すでに存在する場合は、失敗し、 False を返します。
     *
     * @see https://redis.io/commands/hset
     * @param key
     * @param field
     * @param value
     * @return {Promise}
     */
    hset(key: string, field: string, value: string | number): Promise<boolean>;
    /**
     * ハッシュ 型 key から、 fields を削除します。
     *
     * fields は、配列でも、可変長引数でも、渡すことができます。
     *
     * @see https://redis.io/commands/hdel
     * @param key
     * @param fields
     * @return {Promise}
     */
    hdel(key: string, ...fields: any[]): Promise<number>;
    /**
     * ハッシュ型 key から、すべてのフィールドを取得します。
     *
     * ソート済みSET型 の WITH SCORES とは違い、素でオブジェクトで返されます。
     *
     * @see https://redis.io/commands/hgetall
     * @param key
     */
    hgetall(key: string): Promise<{
        [key: string]: string;
    }>;
    /**
     * ハッシュ型 key の field の値を、 increment だけ インクリメント(デクリメント）します。
     *
     * field は存在していない場合は、0 で初期化されてからインクリメント処理されます。
     *
     * @see https://redis.io/commands/hincrby
     * @param key
     * @param field
     * @param increment  インク裏面テョ知りした結果の数値
     */
    hincrby(key: string, field: string, increment: number): Promise<number>;
    expire(key: string, expiration: number): Promise<0 | 1>;
    ttl(key: string): Promise<number>;
    ping(): Promise<string>;
    /**
     * @see https://redis.io/commands/flushdb
     * @return  Promise<boolean>
     */
    flushDb(): Promise<boolean>;
    private _disconnectCompleted();
}
