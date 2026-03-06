import { PlaylogServerControlEventConsumer } from "./PlaylogServerControlEventConsumer";
import { TickCacheManager } from "./TickCache";

export class PlaylogServerControlHandler {
	private playlogServerControlConsumer: PlaylogServerControlEventConsumer;
	private tickCacheManager: TickCacheManager;

	constructor(playlogServerControlConsumer: PlaylogServerControlEventConsumer, tickCacheManager: TickCacheManager) {
		this.playlogServerControlConsumer = playlogServerControlConsumer;
		this.tickCacheManager = tickCacheManager;

		this.playlogServerControlConsumer.on("purge", this._purgeCache.bind(this));
	}

	private _purgeCache(playId: string, ack: (err?: any) => void) {
		this.tickCacheManager.purge(playId);
		ack();
	}
}
