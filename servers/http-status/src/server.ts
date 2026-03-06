// entry point for server
// this file will be run by `npm start` command
import { Application } from "./Application";

const app = new Application();
(async () => {
	await app.initialize();
	await app.boot();

	console.log(`listening: ${app.port}`);
})();
