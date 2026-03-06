import config from "config";
import * as nock from "nock";

const BASE = "/api/v1.0/";

export default class Server {
	public storageServer = nock(config.get("storageServer.url"));
	public get(status, data) {
		this.storageServer = this.storageServer
			.filteringPath((path) => {
				return path.indexOf(BASE) === 0 ? BASE : path;
			})
			.get(BASE);

		if (status >= 400) {
			this.storageServer = this.storageServer.reply(status, {
				meta: { status, errorCode: 1 },
			});
		} else {
			this.storageServer = this.storageServer.reply(status, {
				meta: { status },
				data,
			});
		}
		return this;
	}

	public put(status, data) {
		this.storageServer = this.storageServer
			.filteringPath((path) => {
				return path.indexOf(BASE) === 0 ? BASE : path;
			})
			.put(BASE);

		if (status >= 400) {
			this.storageServer = this.storageServer.reply(status, {
				meta: { status, errorCode: 1 },
			});
		} else {
			this.storageServer = this.storageServer.reply(status, {
				meta: { status },
				data,
			});
		}
		return this;
	}
}
