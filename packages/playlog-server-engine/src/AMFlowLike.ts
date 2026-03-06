import * as amflow from "@akashic/amflow";

export type ExcludeEventFlags = {
	ignorable?: boolean;
};

// playlog-server-engineはplaylog.Event、playlog.Tickの送受信とplaylog.TickListの取得について
// AMFlowLikeで定義したバイナリインタフェースを用いる
export interface AMFlowLike extends amflow.AMFlow {
	onRawTick(handler: (tick: Buffer) => void): void;

	offRawTick(handler: (tick: Buffer) => void): void;

	sendRawTick(tick: Buffer): void;

	onRawEvent(handler: (event: Buffer) => void): void;

	offRawEvent(handler: (event: Buffer) => void): void;

	sendRawEvent(event: Buffer): void;

	getRawTickList(
		begin: number,
		end: number,
		callback: (error: Error, tickList: Buffer[]) => void,
		excludeEventFlags?: ExcludeEventFlags,
	): void;
}
