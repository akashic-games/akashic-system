// new ws.Server() で作ったサーバを close しても、port の bind は解除されないっぽい
// https://github.com/websockets/ws/issues/527
// http.Server とペアで管理して両方 close するようにする
import * as http from "http";
import * as util from "util";
import ws from "ws";

export class TestServer {
	public readonly httpServer: http.Server;
	public readonly wsServer: ws.Server;
	public readonly port: number;

	constructor() {
		this.httpServer = http.createServer();
		this.wsServer = new ws.Server({ server: this.httpServer });
		// ポートは動的アサイン
		const server = this.httpServer.listen();
		const address = server.address();
		if (typeof address === "string") {
			// このケースは UNIX domain socket のときだけなので、起こらないはず
			throw new Error("can't get bound port");
		}
		this.port = address.port;
	}

	public async close(): Promise<void> {
		for (const client of this.wsServer.clients) {
			client.terminate();
		}
		await util.promisify(this.wsServer.close.bind(this.wsServer))().catch(undefined);
		await util.promisify(this.httpServer.close.bind(this.httpServer))().catch(undefined);
	}
}
