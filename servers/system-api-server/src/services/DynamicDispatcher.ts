import { Dispatcher } from "@akashic/dispatcher";
import { LoggerAware } from "@akashic-system/logger";
import { DispatcherBase } from "./DispatcherBase";

export class DynamicDispatcher extends LoggerAware implements DispatcherBase {
	private _defaultTrait: string;
	private _dynamicDispatcher: Dispatcher;

	constructor(trait: string, dispatcher: Dispatcher) {
		super();
		this._defaultTrait = trait;
		this._dynamicDispatcher = dispatcher;
	}

	public dispatch(playId: string, playToken: string, trait?: string, forceProcessId?: string): Promise<string> {
		return new Promise((resolve, reject) => {
			trait = trait || this._defaultTrait;
			this._dynamicDispatcher
				.dispatch(playId, trait, playToken, forceProcessId)
				.then((url) => {
					this.logger.info("dispatched url: " + url);
					resolve(url);
				})
				.catch((error) => {
					reject(error);
				});
		});
	}
}
