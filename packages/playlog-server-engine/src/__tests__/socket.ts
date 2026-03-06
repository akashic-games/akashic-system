import * as http from "http";
import * as querystring from "querystring";
import * as url from "url";
import ws from "ws";
import * as Socket from "../Socket";
import { TestServer as Server } from "../TestServer";

function createClient(port: number, uid: string): ws {
	return new ws("ws://localhost:" + port + "/?uid=" + uid);
}

function createSocket(socket: ws, request: http.IncomingMessage, option?: Socket.Option): Socket.Socket {
	return new Socket.WSSocket(socket, request, option);
}

function parseUid(request: http.IncomingMessage): string {
	const query = url.parse(request.url || "").query;
	return querystring.parse(query || "").uid as string;
}

// 理由はわからないけれど、安定して 1,000 ms 以上かかるので、large 扱い。
it("should ping/pong for keeping alive after reattach", (done) => {
	const server = new Server();

	let c1sock: Socket.Socket = null;
	const timeout = 100;
	let c1pingCount = 0;
	let c2pingCount = 0;

	server.wsServer.on("connection", async (socket, request) => {
		const uid = parseUid(request);
		if (uid === "client1") {
			c1sock = createSocket(socket, request, { _wsKeepAliveTimeout: timeout * 10, _wsKeepAliveInterval: timeout, reopenTimeout: 2000 });
			c1sock.on("close", async () => {
				await server.close();
				done();
			});
			c1sock.on("timeout", async () => {
				await server.close();
				done.fail();
			});
		} else if (uid === "client2") {
			c1sock.attach(socket);
		} else {
			await server.close();
			done.fail();
		}
	});
	const c1 = createClient(server.port, "client1");
	c1.on("ping", () => {
		c1pingCount++;
		if (c1pingCount === 5) {
			const c2 = createClient(server.port, "client2");
			c2.on("ping", () => {
				c2pingCount++;
				if (c2pingCount === 5) {
					expect(c1pingCount).toBe(5);
					c1sock.close();
				}
			});
		}
	});
});
