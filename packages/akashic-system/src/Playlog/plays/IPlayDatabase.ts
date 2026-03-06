export interface IPlayDatabase {
	getStarted(playId: string): Promise<Date | null>;
}
