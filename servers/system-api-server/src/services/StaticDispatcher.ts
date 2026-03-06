import { DispatcherBase } from "./DispatcherBase";

export class StaticDispatcher implements DispatcherBase {
	private _playlogServerUrl: string;

	constructor(playlogServerUrl: string) {
		this._playlogServerUrl = playlogServerUrl;
	}

	public dispatch(_playId: string, _playToken: string, _trait?: string, _forceProcessId?: string): Promise<string> {
		return Promise.resolve(this._playlogServerUrl);
	}
}
