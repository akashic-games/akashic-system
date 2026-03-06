/**
 * playing=プレイ中で、ActiveAEが新規tick/startPointを発行している状態
 * closing=プレイが終了して、ActiveAEが新規tick/startPointを発行しなくなっているが、まだキューにtickが残ってたり、キュー自体が消えてない状態
 * closed=closingに加えてキューも消して後片付けが完了している状態
 */
export type WriteStatus = "playing" | "closing" | "closed";

export interface IPlaylogQueueStatusDatabase {
	getWritingPlays(): Promise<{ playId: string; writeStatus: Omit<"closed", WriteStatus> }[]>;
	setPlaying(playId: string): Promise<void>;
	setClosing(playId: string): Promise<void>;
	setClosed(playId: string): Promise<void>;
}
