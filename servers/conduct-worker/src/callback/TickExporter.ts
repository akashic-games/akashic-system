import * as restClientCore from "@akashic/rest-client-core";

export class TickExporter {
	private _putStartPointMethod: restClientCore.Method<void>;
	private _putTickMethod: restClientCore.Method<void>;

	constructor(baseUrl: string) {
		const base = baseUrl.charAt(baseUrl.length - 1) === "/" ? baseUrl.substr(0, baseUrl.length - 1) : baseUrl;
		this._putStartPointMethod = new restClientCore.Method<void>({
			url: base + "/v1.0/plays/:id/startpoints",
			method: "POST",
		});
		this._putTickMethod = new restClientCore.Method<void>({
			url: base + "/v1.0/plays/:id/ticks",
			method: "POST",
		});
	}

	public putStartPoint(playId: string, startPoint: any): Promise<void> {
		return this._putStartPointMethod.exec({ id: playId }, { startPoint }).then((): void => undefined);
	}

	public putTick(playId: string, tick: any): Promise<void> {
		return this._putTickMethod.exec({ id: playId }, { tick }).then((): void => undefined);
	}
}
