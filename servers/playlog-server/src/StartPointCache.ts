import * as amflow from "@akashic/amflow";

export type StartPointHandler = (playId: string, frame: number) => Promise<amflow.StartPoint>;

export class StartPointCache {
	public playId: string;
	public destroyed: boolean;
	private handler: StartPointHandler;
	private startPoints: { [frame: number]: amflow.StartPoint };
	private waitingRequests: { [frame: number]: [(startPoint: amflow.StartPoint) => void, (err: any) => void][] };
	constructor(playId: string, handler: StartPointHandler) {
		this.playId = playId;
		this.destroyed = false;
		this.handler = handler;
		this.startPoints = {};
		this.waitingRequests = {};
	}

	public get(frame: number): Promise<amflow.StartPoint> {
		if (this.destroyed) {
			return Promise.reject(new Error("cache was destroyed"));
		}
		if (!this.startPoints[frame]) {
			return new Promise<amflow.StartPoint>((resolve, reject) => {
				if (this.waitingRequests[frame]) {
					this.waitingRequests[frame].push([resolve, reject]);
				} else {
					this.waitingRequests[frame] = [[resolve, reject]];
					this.handler(this.playId, frame)
						.then((startPoint) => {
							if (this.destroyed) {
								return;
							}
							if (startPoint != null) {
								this.startPoints[frame] = startPoint;
							}
							const waitings = this.waitingRequests[frame];
							delete this.waitingRequests[frame];
							waitings.forEach((waiting) => waiting[0](startPoint));
						})
						.catch((err) => {
							if (this.destroyed) {
								return;
							}
							const waitings = this.waitingRequests[frame];
							delete this.waitingRequests[frame];
							waitings.forEach((waiting) => waiting[1](err));
						});
				}
			});
		}
		return Promise.resolve(this.startPoints[frame]);
	}

	public destroy(): void {
		this.destroyed = true;
		if (this.waitingRequests) {
			const err = new Error("cache was destroyed");
			Object.keys(this.waitingRequests).forEach((frame) => {
				this.waitingRequests[Number(frame)].forEach((waiting) => waiting[1](err));
			});
			this.waitingRequests = null;
		}
		this.playId = null;
		this.handler = null;
		this.startPoints = null;
	}
}

export class StartPointCacheManager {
	private handler: StartPointHandler;
	private caches: { [playId: string]: StartPointCache };
	constructor(handler: StartPointHandler) {
		this.handler = handler;
		this.caches = {};
	}
	public getCache(playId: string): StartPointCache {
		if (!this.caches[playId]) {
			this.caches[playId] = new StartPointCache(playId, this.handler);
		}
		return this.caches[playId];
	}
	public purge(playId: string): void {
		if (this.caches[playId]) {
			this.caches[playId].destroy();
		}
		delete this.caches[playId];
	}
}
