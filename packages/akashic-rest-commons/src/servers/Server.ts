import express = require("express");
import http = require("http");
import * as https from "https";
import { createLogMiddleware } from "./LogMiddleware";
import DateJsonReplacer = require("./DateJsonReplacer");
import ServerSettings = require("./ServerSettings");

class Server {
	public static createServer(settings: ServerSettings): http.Server | https.Server {
		let handler: express.Handler;
		if (settings.logHandler) {
			handler = settings.logHandler;
		} else if (settings.accessLogger) {
			handler = createLogMiddleware(settings.accessLogger, { level: "auto" });
		} else {
			throw new Error("invalid logger setting.");
		}
		const app = express();
		DateJsonReplacer.setUp(app);
		app.use(handler);
		app.use(settings.router);

		for (const middleware of settings.middlewares || []) {
			app.use(middleware);
		}

		// HTTPS が使えそうなら、HTTPS を使う
		if (settings.key && settings.cert) {
			const key = settings.key;
			const cert = settings.cert;
			return https.createServer({ key, cert }, app);
		}
		return http.createServer(app);
	}

	public app?: http.Server | https.Server;

	public start(settings: ServerSettings): http.Server | https.Server {
		if (this.app) {
			throw new Error("invalid operation: HttpServer already started");
		}
		this.app = Server.createServer(settings);
		return this.app.listen(settings.listening);
	}
}

export = Server;
