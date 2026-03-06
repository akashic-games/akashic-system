export interface DispatcherBase {
	dispatch(playId: string, playToken: string, trait?: string, forceProcessId?: string): Promise<string>;
}
