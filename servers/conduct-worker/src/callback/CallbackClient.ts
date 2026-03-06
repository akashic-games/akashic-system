import { EventLike } from "@akashic/callback-publisher";
import * as restClientCore from "@akashic/rest-client-core";
import { LRUCache } from "lru-cache";

export class CallbackClient {
	private pool: LRUCache<string, restClientCore.Method<any>>;

	constructor() {
		this.pool = new LRUCache<string, restClientCore.Method<any>>({
			max: 1000,
			ttl: 24 * 1000 * 60 * 60,
		});
	}

	public post(url: string, args: EventLike<any>) {
		return this.getMethod(url).exec(undefined, JSON.stringify(args));
	}

	private getMethod(url: string, options?: restClientCore.MethodOptions) {
		const cacheMethod = this.pool.get(url);
		if (cacheMethod) {
			return cacheMethod;
		}
		const method = new restClientCore.Method<any>(this.createApiInfo(url), (data) => data, options);
		this.pool.set(url, method);
		return method;
	}

	private createApiInfo(url: string): restClientCore.NicoApiInfo {
		return {
			url,
			method: "POST",
		};
	}
}
