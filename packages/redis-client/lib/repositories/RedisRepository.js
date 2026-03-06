"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const redis = require("ioredis");
const RedisDataSource_1 = require("../entities/RedisDataSource");
/**
 * Redis リポジトリ
 * - 各操作開始時に未接続時は内部で接続を試みる。connect() は明示的に呼び出さなくても良い。
 */
class RedisRepository {
    constructor(dataSource, errorHandler) {
        this.isCluster = false;
        this._dataSource = dataSource;
        this._client = undefined;
        this._errorHandler = errorHandler;
        if (RedisDataSource_1.isRedisClusterDataSource(dataSource)) {
            this.isCluster = true;
        }
    }
    connect() {
        if (!this.connected()) {
            if (!this.isCluster) {
                // https://github.com/luin/ioredis/blob/master/API.md#Redis+connect
                const dataSource = this._dataSource;
                this._client = new redis(dataSource.port, dataSource.host, dataSource.option);
            }
            else {
                const dataSource = this._dataSource;
                this._client = new redis.Cluster(dataSource.hosts, dataSource.option);
            }
            if (this._errorHandler) {
                this._client.on("error", this._errorHandler);
            }
        }
    }
    disconnect() {
        if (this.connected()) {
            // disconnect は、保留中の処理があっても即座に終了してしまうため、quitを使ってます。
            if (this.isCluster) {
                this._client.quit((err, res) => {
                    if (!err) {
                        this._disconnectCompleted();
                    }
                });
            }
            else {
                // https://github.com/luin/ioredis/blob/master/API.md#Redis+disconnect
                this._client.quit([], (err, res) => {
                    if (!err) {
                        this._disconnectCompleted();
                    }
                });
            }
        }
    }
    connected() {
        return !!this._client;
    }
    zIncrBy(key, increment, member) {
        this.connect();
        return new Promise((resolve, reject) => {
            this._client.zincrby([key, increment, member], (error, score) => {
                if (error) {
                    return reject(error);
                }
                resolve(Number(score));
            });
        });
    }
    /**
     * ZRANGEBYSCORE
     * @note
     * 本操作は condition.withScores 引数にかかわらずフラットな文字列配列を返す。
     * - withScores:false => ["m1", "m2", "m3"]
     * - withScores:true  => ["m1", "1", "m2", "2", "m3", "3"]
     * 後者を member: string, score: number で再配列するのはコストが発生するため、呼び出し側で行うこと。
     * - e.g. RedisUtil.toMemberWithScore(zRevRangeByScoreList); // => {member, score}[]
     */
    zRangeByScore(key, condition, reversed) {
        this.connect();
        return new Promise((resolve, reject) => {
            const max = typeof condition.max === "number" ? condition.max : "+inf";
            const min = typeof condition.min === "number" ? condition.min : "-inf";
            let args = reversed ? [key, max, min] : [key, min, max];
            if (condition.withScores) {
                args.push("WITHSCORES");
            }
            if (condition.limit) {
                args = args.concat(["LIMIT", condition.limit.offset, condition.limit.count]);
            }
            if (reversed) {
                this._client.zrevrangebyscore(args, (error, value) => {
                    if (error) {
                        return reject(error);
                    }
                    resolve(value);
                });
            }
            else {
                this._client.zrangebyscore(args, (error, value) => {
                    if (error) {
                        return reject(error);
                    }
                    resolve(value);
                });
            }
        });
    }
    zRevRangeByScore(key, condition) {
        return this.zRangeByScore(key, condition, true);
    }
    zAdd(key, score, member) {
        this.connect();
        return new Promise((resolve, reject) => {
            this._client.zadd([key, score, member], (error, score) => {
                if (error) {
                    return reject(error);
                }
                resolve(Number(score));
            });
        });
    }
    zRem(key, member) {
        this.connect();
        return new Promise((resolve, reject) => {
            this._client.zrem([key, member], (error, numRemoved) => {
                if (error) {
                    return reject(error);
                }
                resolve(Number(numRemoved));
            });
        });
    }
    set(key, value) {
        this.connect();
        return new Promise((resolve, reject) => {
            this._client.set(key, value, (error, res) => {
                if (error) {
                    return reject(error);
                }
                resolve(res);
            });
        });
    }
    setex(key, value, expireSecond) {
        this.connect();
        return new Promise((resolve, reject) => {
            this._client.setex(key, expireSecond, value, (error, res) => {
                if (error) {
                    return reject(error);
                }
                resolve(res);
            });
        });
    }
    setnx(key, value) {
        this.connect();
        return new Promise((resolve, reject) => {
            this._client.setnx(key, value, (error, res) => {
                if (error) {
                    return reject(error);
                }
                resolve(Number(res));
            });
        });
    }
    get(key) {
        this.connect();
        return new Promise((resolve, reject) => {
            this._client.get(key, (error, res) => {
                if (error) {
                    return reject(error);
                }
                resolve(res);
            });
        });
    }
    del(key) {
        this.connect();
        return new Promise((resolve, reject) => {
            this._client.del(key, (error, res) => {
                if (error) {
                    return reject(error);
                }
                resolve(Number(res)); // 削除されたキー数が返ってくるので number になれるはず
            });
        });
    }
    incr(key) {
        this.connect();
        return new Promise((resolve, reject) => {
            this._client.incr(key, (error, res) => {
                if (error) {
                    return reject(error);
                }
                resolve(res);
            });
        });
    }
    incrBy(key, value) {
        this.connect();
        return new Promise((resolve, reject) => {
            this._client.incrby(key, value, (error, res) => {
                if (error) {
                    return reject(error);
                }
                resolve(res);
            });
        });
    }
    decr(key) {
        this.connect();
        return new Promise((resolve, reject) => {
            this._client.decr(key, (error, res) => {
                if (error) {
                    return reject(error);
                }
                resolve(res);
            });
        });
    }
    decrBy(key, value) {
        this.connect();
        return new Promise((resolve, reject) => {
            this._client.decrby(key, value, (error, res) => {
                if (error) {
                    return reject(error);
                }
                resolve(res);
            });
        });
    }
    /**
     * key のリストの先頭にstring型のvalueをpushし、要素数を返します
     */
    lpush(key, value) {
        this.connect();
        return new Promise((resolve, reject) => {
            this._client.lpush(key, value, (error, res) => {
                if (error) {
                    return reject(error);
                }
                resolve(Number(res));
            });
        });
    }
    /**
     * key のリストの末尾にstring型のvalueをpushし、要素数を返します
     */
    rpush(key, value) {
        this.connect();
        return new Promise((resolve, reject) => {
            this._client.rpush(key, value, (error, res) => {
                if (error) {
                    return reject(error);
                }
                resolve(Number(res));
            });
        });
    }
    /**
     * key のリストの先頭から要素を取得し、その要素をリストから削除します
     */
    lpop(key) {
        this.connect();
        return new Promise((resolve, reject) => {
            this._client.lpop(key, (error, res) => {
                if (error) {
                    return reject(error);
                }
                resolve(res);
            });
        });
    }
    /**
     * key のリストの末尾から要素を取得し、その要素をリストから削除します
     */
    rpop(key) {
        this.connect();
        return new Promise((resolve, reject) => {
            this._client.rpop(key, (error, res) => {
                if (error) {
                    return reject(error);
                }
                resolve(res);
            });
        });
    }
    /**
     * key のリストから、start, end の範囲にある要素を配列で返します。
     * start, end ともに 0 を指定すると、先頭の１要素だけを返します。
     */
    lrange(key, start, end) {
        this.connect();
        return new Promise((resolve, reject) => {
            this._client.lrange(key, start, end, (error, res) => {
                if (error) {
                    return reject(error);
                }
                resolve(res);
            });
        });
    }
    /**
     * key のリストから、count個数分だけ、value に一致する値を削除し
     * 削除された要素数を返します。
     * count に 0を指定すると、すべての一致する要素を削除します。
     * 負数を指定すると、末尾から削除していきます。
     */
    lrem(key, count, value) {
        this.connect();
        return new Promise((resolve, reject) => {
            this._client.lrem(key, count, value, (error, res) => {
                if (error) {
                    return reject(error);
                }
                resolve(Number(res));
            });
        });
    }
    // SET 型
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
    sadd(key, ...members) {
        this.connect();
        return new Promise((resolve, reject) => {
            this._client.sadd(key, ...members, (error, res) => {
                if (error) {
                    return reject(error);
                }
                resolve(Number(res));
            });
        });
    }
    // smove はRedisクラスタで使用できないため提供されません
    /**
     * セット型 key に存在する member の一覧を返します。
     *
     * @see https://redis.io/commands/smembers
     * @param keys
     * @return {Promise}  Promise<string[]> 。 `sadd` では数値だったとしても、 Redis は常に文字列で返す。
     *
     */
    smembers(keys) {
        this.connect();
        return new Promise((resolve, reject) => {
            this._client.smembers(keys, (error, res) => {
                if (error) {
                    return reject(error);
                }
                resolve(res);
            });
        });
    }
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
    srem(key, ...members) {
        this.connect();
        return new Promise((resolve, reject) => {
            this._client.srem(key, ...members, (error, res) => {
                if (error) {
                    return reject(error);
                }
                resolve(Number(res));
            });
        });
    }
    /**
     * セット型 key に member が存在するかを返します。
     *
     * @see https://redis.io/commands/sismember
     * @param key
     * @param member
     * @return {Promise}
     */
    sismember(key, member) {
        this.connect();
        return new Promise((resolve, reject) => {
            this._client.sismember(key, member, (error, res) => {
                if (error) {
                    return reject(error);
                }
                resolve(Boolean(res));
            });
        });
    }
    // HASH 型
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
    hset(key, field, value) {
        this.connect();
        return new Promise((resolve, reject) => {
            this._client.hset(key, field, value, (error, res) => {
                if (error) {
                    return reject(error);
                }
                resolve(Boolean(res));
            });
        });
    }
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
    hdel(key, ...fields) {
        this.connect();
        return new Promise((resolve, reject) => {
            this._client.hdel(key, fields, (error, res) => {
                if (error) {
                    return reject(error);
                }
                resolve(Number(res));
            });
        });
    }
    /**
     * ハッシュ型 key から、すべてのフィールドを取得します。
     *
     * ソート済みSET型 の WITH SCORES とは違い、素でオブジェクトで返されます。
     *
     * @see https://redis.io/commands/hgetall
     * @param key
     */
    hgetall(key) {
        this.connect();
        return new Promise((resolve, reject) => {
            this._client.hgetall(key, (error, res) => {
                if (error) {
                    return reject(error);
                }
                resolve(res);
            });
        });
    }
    /**
     * ハッシュ型 key の field の値を、 increment だけ インクリメント(デクリメント）します。
     *
     * field は存在していない場合は、0 で初期化されてからインクリメント処理されます。
     *
     * @see https://redis.io/commands/hincrby
     * @param key
     * @param field
     * @param increment  インクリメントした結果の数値
     */
    hincrby(key, field, increment) {
        this.connect();
        return new Promise((resolve, reject) => {
            this._client.hincrby(key, field, increment, (error, res) => {
                if (error) {
                    return reject(error);
                }
                resolve(Number(res));
            });
        });
    }
    expire(key, expiration) {
        this.connect();
        return this._client.expire(key, expiration);
    }
    ttl(key) {
        this.connect();
        return this._client.ttl(key);
    }
    ping() {
        this.connect();
        return new Promise((resolve, reject) => {
            this._client.ping((error, res) => {
                if (error) {
                    return reject(error);
                }
                resolve(res);
            });
        });
    }
    // select はRedis Clusterで使用できないため提供されません
    /**
     * @see https://redis.io/commands/flushdb
     * @return  Promise<boolean>
     */
    flushDb() {
        // むやみに接続して、デフォルトの DB を消したりしたくないので、 this._connect() しない。
        // 勝手に接続して、意図しない DB を Flush するような事故は回避する。
        if (!this.connected()) {
            return Promise.reject(new Error("not yet connected."));
        }
        // main
        if (this.isCluster) {
            const clients = this._client.nodes("master");
            const Errors = [];
            let response = true;
            return new Promise((resolve, reject) => {
                clients.forEach((node) => {
                    node.flushdb((error, res) => {
                        if (error) {
                            Errors.push(error);
                        }
                        else {
                            response = response && Boolean(res);
                        }
                    });
                });
                if (Errors.length > 0) {
                    return reject(Errors);
                }
                resolve(response);
            });
        }
        else {
            return new Promise((resolve, reject) => {
                this._client.flushdb((error, res) => {
                    if (error) {
                        return reject(error);
                    }
                    resolve(Boolean(res));
                });
            });
        }
    }
    _disconnectCompleted() {
        this._client = undefined;
    }
}
exports.RedisRepository = RedisRepository;
