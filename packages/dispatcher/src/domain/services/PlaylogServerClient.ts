import { NicoApiResponse } from "@akashic/rest-client-core";
import { BaseApiClient, MethodInfo } from "../utils/BaseApiClient";

export namespace PlaylogServerMethods {
	export const POST_DISPATCHED_PLAY: MethodInfo = {
		path: "/v1.0/dispatched_plays/:playId/reservations",
		method: "POST",
	};
}

export class PlaylogServerClient extends BaseApiClient {
	// タイムアウトするまでのミリ秒。
	private static readonly TIMEOUT_MSECS: number = 200;

	constructor(baseUrl: string) {
		super(baseUrl);
	}
	public postDispatchedPlay(playId: string, playToken: string): Promise<NicoApiResponse<{}>> {
		return this.createMethod<{}>(PlaylogServerMethods.POST_DISPATCHED_PLAY, undefined, {
			timeout: PlaylogServerClient.TIMEOUT_MSECS,
		}).exec({ playId }, { playToken });
	}
}

// TODO: プールの上限を設ける, 高々数十プロセス * 数十サーバなので現状は設けてない
export class PlaylogServerClientPool {
	private _clients: { [baseUrl: string]: PlaylogServerClient } = {};

	public get(baseUrl: string): PlaylogServerClient {
		let client = this._clients[baseUrl];
		if (!client) {
			client = new PlaylogServerClient(baseUrl);
			this._clients[baseUrl] = client;
		}
		return client;
	}
}
