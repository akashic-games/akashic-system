export interface IPlaylogLock {
	withPlaylogLock<T>(playId: string, inLock: () => Promise<T>): Promise<T>;
}
