import { RedisCommander } from "ioredis";

export enum SESSION_STATUS {
	RESERVED,
	STARTED,
}

/**
 * Session の状態を、Playlog Server と関連付けて保存し、参照できるようにするためのクラス。
 * 各 Playlog Server が保持している Session を監視するために使われる。
 *
 * ## 概要
 * PlaylogServerID × 各状態 ごとに、 Set 型の Key を作成する。
 * member は、 PlayID（セッションごとのID）。
 * 状態遷移をした場合は、 `SMOVE` で 所属するKeyを遷移させる。
 * `SADD` `SMOVE` `SREM` は、どれも O(1) で計算できるので、このクラスに論理レイヤでのボトルネックは存在しないはず。
 *
 * ## 状態遷移
 * 以下の PlantUML の状態遷移図の各状態が、 Playlog Server インスタンスごとに、Redis で保存される。
 * 各状態遷移が、このクラスのメソッド名になっている。
 *
 * ```plantuml
 * @startuml
 * [*] -> reserved : reserve
 * reserved -> started: start
 * reserved -> [*]: revoke
 * started -> [*]: end
 * @enduml
 * ```
 */
export class PlaylogSessionObserver {
	protected get keyName(): string {
		return this.processId + "__" + "session_summary"; // セパレータは、 "_" が2つ。
	}

	protected static getSessionStatusString(status: SESSION_STATUS): string {
		return SESSION_STATUS[status].toLowerCase();
	}
	/**
	 * 統計データの保存用の Redis Repository
	 */
	private redisRepository: RedisCommander;
	/**
	 * playlog server の プロセスID。サーバ識別子。
	 * 文字列なので、そのままつかいやすい。
	 */
	private processId: string;

	/**
	 * @param precessId
	 * @param redisRepository Session の各イベントが発火されたときに、この Redis クライアント を使って監視用の情報を保存する。
	 *   単体テストをするときは、これの Mock を Spy させれば良い。
	 */
	public constructor(precessId: string, redisRepository: RedisCommander) {
		this.processId = precessId;
		this.redisRepository = redisRepository;
	}

	public init(): Promise<void> {
		return Promise.all([
			this.redisRepository.hset(this.keyName, PlaylogSessionObserver.getSessionStatusString(SESSION_STATUS.RESERVED), 0),
			this.redisRepository.hset(this.keyName, PlaylogSessionObserver.getSessionStatusString(SESSION_STATUS.STARTED), 0),
		]).then(() => undefined);
	}

	public onReserve(): Promise<number> {
		return this.redisRepository.hincrby(this.keyName, PlaylogSessionObserver.getSessionStatusString(SESSION_STATUS.RESERVED), 1);
	}

	public onStart(): Promise<number[]> {
		return Promise.all([
			this.redisRepository.hincrby(this.keyName, PlaylogSessionObserver.getSessionStatusString(SESSION_STATUS.RESERVED), -1),
			this.redisRepository.hincrby(this.keyName, PlaylogSessionObserver.getSessionStatusString(SESSION_STATUS.STARTED), 1),
		]).catch((e: Error) => {
			return Promise.reject(e);
		});
	}

	/**
	 * Session が閉じられたときの処理
	 *
	 * ゲームクライアントからセッション終了の操作があった場合がこれ。
	 * タイムアウトなどは、 revoke 。
	 *
	 * 疑似終了状態に遷移する。
	 */
	public onEnd(): Promise<number> {
		return this.redisRepository.hincrby(this.keyName, PlaylogSessionObserver.getSessionStatusString(SESSION_STATUS.STARTED), -1);
	}

	/**
	 * タイムアウトでセッション予約が無効にされたときの処理
	 */
	public onRevoke(): Promise<number> {
		return this.redisRepository.hincrby(this.keyName, PlaylogSessionObserver.getSessionStatusString(SESSION_STATUS.RESERVED), -1);
	}
}
