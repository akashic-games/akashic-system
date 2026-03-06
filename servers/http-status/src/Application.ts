import { ApplicationBase, IApplication } from "@akashic/akashic-system";

import http from "http";
import express from "express";
import { AddressInfo } from "net";

export class Application extends ApplicationBase {
	private app: express.Application = express();
	private server?: http.Server;

	public get port(): number | null {
		// string が戻ってくるのは UNIX ドメインソケット等の場合の話。
		const addr: AddressInfo | null = this.server?.address() as AddressInfo;
		if (addr == null) {
			return null;
		}

		return addr.port;
	}

	public async initialize(): Promise<IApplication> {
		for (const code of Object.keys(http.STATUS_CODES)) {
			this.app.get(`/${code}/*`, (_, res) => {
				res.status(parseInt(code, 10));
				res.send(http.STATUS_CODES[code]);
				res.end();
			});
		}

		return this;
	}

	public async boot(): Promise<IApplication> {
		if (this.server) {
			return this;
		}

		this.server = this.app.listen();

		return this;
	}

	public terminate(): Promise<IApplication> {
		return new Promise((resolve, reject) => {
			// boot/initialize が実行されていないなど、不正な状態遷移をした場合
			if (this.server == null) {
				resolve(this);
				return;
			}

			this.server.close((err) => {
				if (err != null) {
					reject(err);
					return;
				}

				resolve(this);
				return;
			});
		});
	}
}
