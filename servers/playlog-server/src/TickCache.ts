import * as amflowMessage from "@akashic/amflow-message";
import log4js from "log4js";

const logger = log4js.getLogger("out");

export type TickComplementRequestHandler = (playId: string, begin: number, end: number) => Promise<Buffer[]>;

interface Waiting {
	begin: number;
	end: number;
	resolve: (tickList: Buffer[]) => void;
	reject: (err: any) => void;
}

interface Complementing {
	begin: number;
	end: number;
	waitings: Waiting[];
}

export class TickCache {
	public playId: string;
	public destroyed: boolean;
	private manager: TickCacheManager;
	// TODO: eventTicksをBuffer[]にしたTickList形式にしたほうがメモリ効率はよい
	// 欠落チェック・補完処理が複雑になるため見送り
	// amflow-message/playlog-server-engineの修正も必要になる。
	private ticks: Buffer[];
	private complementHandler: TickComplementRequestHandler;
	private complementings: Complementing[];
	constructor(playId: string, complementHandler: TickComplementRequestHandler) {
		this.playId = playId;
		this.destroyed = false;
		this.complementHandler = complementHandler;
		this.ticks = [];
		this.complementings = [];
	}

	/**
	 * キャッシュにTickを追加する。直前に呼び出したTickの次のフレームのTickであることを期待する。
	 */
	public add(rawTick: Buffer): void {
		if (this.destroyed) {
			return;
		}
		const tick = amflowMessage.decodeTick(rawTick);
		// frameが欲しいだけなのでdecode無しでバイナリから読み取ることも可能
		const frame = tick[0];
		if (frame !== 0 && this.ticks[frame - 1] == null) {
			// 直前のTickが欠落している場合は、それ以前の連続して欠落したTickも含めて補完を試みる。
			// プレイの途中でTickのconsumeを開始した場合、必ずクライアントはそれまでのTickListをリクエストしてくる。
			// クライアントからのリクエスト前に先にストアから補完を行いキャッシュ生成を試みる。
			let complementBegin = frame - 1;
			while (complementBegin > 0) {
				if (this.ticks[complementBegin - 1] != null) {
					break;
				}
				complementBegin--;
			}
			this.startComplememnt(complementBegin, frame);
		}
		logger.debug(`add cache. playId: ${this.playId}, frame: ${frame}`);
		this.ticks[frame] = rawTick;
	}

	/**
	 * キャッシュからTickリストを取得する。
	 */
	public get(begin: number, end: number): Promise<Buffer[]> {
		if (this.destroyed) {
			return Promise.reject(new Error("cache was destroyed"));
		}
		if (end - begin <= 0) {
			return Promise.resolve([]);
		}
		logger.debug(`get cache. playId: ${this.playId}, begin: ${begin}, end: ${end}`);
		const ticks = this.ticks.slice(begin, end);
		const targetComplementRange = this.getComplementRangeIfNeeded(ticks, begin, end);
		if (targetComplementRange) {
			return new Promise<Buffer[]>((resolve, reject) => {
				const comp = this.getComplementing(targetComplementRange.begin, targetComplementRange.end);
				// 補完中のものがあれば使い回す
				if (comp) {
					comp.waitings.push({ begin, end, resolve, reject });
				} else {
					this.startComplememnt(targetComplementRange.begin, targetComplementRange.end, { begin, end, resolve, reject });
				}
			});
		}
		return Promise.resolve(ticks);
	}

	/**
	 * キャッシュを削除する。
	 */
	public destroy(): void {
		this.destroyed = true;
		if (this.complementings) {
			const err = new Error("cache was destroyed");
			this.complementings.forEach((complementing) => {
				complementing.waitings.forEach((waiting) => waiting.reject(err));
			});
			this.complementings = null;
		}
		logger.debug(`destroy cache. playId: ${this.playId}`);
		this.playId = null;
		this.complementHandler = null;
		this.ticks = null;
	}

	/**
	 * Tickの補完が必要かどうかを判断し、必要な場合はその範囲を返す。不要な場合（キャッシュに全てヒットした）はnullを返す。
	 * 以下のケースで補完が必要だと判定する。
	 * - 与えられたTickリストに欠落があるとき
	 *   - 例: [empty x 10, buf, buf, buf]、[buf, buf, empty x 2, buf, buf]
	 * - 与えられたTickリストが指定された範囲を満たしていないとき
	 */
	private getComplementRangeIfNeeded(cachedTicks: Buffer[], begin: number, end: number): { begin: number; end: number } | null {
		let compBegin;
		for (compBegin = begin; compBegin < end; compBegin++) {
			// Tickの欠落に当たったとき、または終端に到達したときにbreak
			if (cachedTicks[compBegin - begin] == null) {
				break;
			}
		}
		if (compBegin === end) {
			return null;
		} else {
			// end側はキャッシュの存在判定無しで取得してしまう
			return { begin: compBegin, end };
		}
	}

	/**
	 * begin/endの範囲を包含する補完処理が既に開始されている場合は、そのComplementingを取得する。
	 */
	private getComplementing(begin: number, end: number): Complementing | null {
		for (let i = 0; i < this.complementings.length; i++) {
			const complementing = this.complementings[i];
			if (complementing.begin <= begin && end <= complementing.end) {
				return complementing;
			}
		}
		return null;
	}

	/**
	 * キャッシュの補完を行う。
	 */
	private startComplememnt(begin: number, end: number, waiting?: Waiting): void {
		logger.debug(`startComplememnt. playId: ${this.playId}, begin: ${begin}, end: ${end}`);
		const complementing: Complementing = { begin, end, waitings: waiting ? [waiting] : [] };
		this.complementings.push(complementing);
		this.complementHandler(this.playId, begin, end)
			.then((ticks) => {
				if (this.destroyed) {
					return;
				}
				// 補完処理リストから削除する
				const idx = this.complementings.indexOf(complementing);
				this.complementings.splice(idx, 1);

				// キャッシュを更新する
				for (let i = 0; i < ticks.length; i++) {
					this.ticks[begin + i] = ticks[i];
				}

				// 待機中ハンドラを呼び出す。
				// this.ticks全てをベースにすると、結果のリストに欠落が発生する可能性がある（リアルタイムTick受信が先行しているケース等）ある。
				// getTickListのレスポンスは指定されたレンジに対して、Tickの不足はあるとしても欠落はあってはならない（表現手段もない）。
				// そうなることを回避するため、今回補完したticksの末尾までの範囲で取得するようにする。
				const maxSliceEnd = complementing.begin + ticks.length;
				complementing.waitings.forEach((waiting) => {
					waiting.resolve(this.ticks.slice(waiting.begin, Math.min(maxSliceEnd, waiting.end)));
				});
			})
			.catch((err) => {
				if (this.destroyed) {
					return;
				}
				// 補充処理リストから削除する
				const idx = this.complementings.indexOf(complementing);
				this.complementings.splice(idx, 1);

				// 待機中エラーハンドラを呼び出す
				complementing.waitings.forEach((waiting) => waiting.reject(err));
			});
	}
}

export class TickCacheManager {
	private caches: { [playId: string]: TickCache };
	private handler: TickComplementRequestHandler;
	constructor(handler: TickComplementRequestHandler) {
		this.handler = handler;
		this.caches = {};
	}
	public getCache(playId: string): TickCache {
		if (!this.caches[playId]) {
			this.caches[playId] = new TickCache(playId, this.handler);
		}
		return this.caches[playId];
	}
	public purge(playId: string): void {
		logger.info(`purge cache request. playId: ${playId}`);
		if (this.caches[playId]) {
			this.caches[playId].destroy();
		}
		delete this.caches[playId];
	}
}
