export * from "./Monitor";
export * from "./Core";
export * from "./Configs";
export * from "./MasterController";
export * from "./MasterStatus";
export * from "./MasterEndpoint";

import { Client, createClient, Option, State } from "node-zookeeper-client";
import { TypedEventEmitter } from "../util/TypedEventEmitter";
import * as Configs from "./Configs";
import { Core } from "./Core";

let core: Core | null = null;
export const event = new TypedEventEmitter<{ connectionDead: void }>();
export async function connect(config: Configs.ZookeeperConfig): Promise<Core> {
	if (core) {
		return Promise.resolve(core);
	}
	const client = await resolveClient(config);
	client.on("expired", () => event.emit("connectionDead", undefined));
	core = new Core(client);
	return core;
}

function resolveClient(config: Configs.ZookeeperConfig): Promise<Client> {
	const { connectionString, options } = convertOptions(config);
	const client = createClient(connectionString, options);

	const connectClientPromise = new Promise<Client>((resolve, reject) => {
		client.once("connected", () => {
			resolve(client);
		});
		client.once("state", (state) => {
			if (state === State.DISCONNECTED || state === State.AUTH_FAILED || state === State.EXPIRED || state === State.CONNECTED_READ_ONLY) {
				reject(new Error(`Zookeeper connect failed: ${state.code}`));
			}
		});
		client.connect();
	});
	const timeoutPromise = new Promise<Client>((_, reject) => {
		setTimeout(() => reject(new Error("timeout")), options?.sessionTimeout ?? 30000);
	});
	return Promise.race([connectClientPromise, timeoutPromise]);
}

function convertOptions(config: Configs.ZookeeperConfig): { connectionString: string; options?: Partial<Option> } {
	const connectionString = config.hosts
		.map((host) => {
			let hostString = host.host + ":" + host.port;
			if (host.path) {
				hostString += host.path;
			}
			return hostString;
		})
		.join(",");
	const result: { connectionString: string; options?: Partial<Option> } = { connectionString };
	if (config.options) {
		result.options = {
			sessionTimeout: config.options.timeout,
			retries: config.options.retries,
		};
	}
	return result;
}
