import { Client } from "node-zookeeper-client";
import { MasterController } from "./MasterController";
import { MasterEndpoint } from "./MasterEndpoint";
import { Monitor } from "./Monitor";

export class Core {
	private _monitor: Monitor;
	private _master: MasterController;
	private _endpoint: MasterEndpoint;
	get monitor(): Monitor {
		return this._monitor;
	}
	get masterController(): MasterController {
		return this._master;
	}
	get endpoint(): MasterEndpoint {
		return this._endpoint;
	}
	constructor(client: Client) {
		this._monitor = new Monitor(client);
		this._master = new MasterController(client);
		this._endpoint = new MasterEndpoint(client);
	}
}
