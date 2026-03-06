import { ZookeeperDataSource } from "../entities/ZookeeperDataSource";
import { Client, createClient, Option, State } from "node-zookeeper-client";

// TODO: @akashic/cluster-core との統合を検討

export async function resolveClient(dataSource: ZookeeperDataSource): Promise<Client> {
	const { connectionString, options } = toZookeeperConfig(dataSource);
	const client = createClient(connectionString, options);

	const connectClientPromise = new Promise<Client>((resolve, reject) => {
		client.once("connected", () => {
			resolve(client);
		});
		client.once("state", (state) => {
			if (state === State.DISCONNECTED || state === State.AUTH_FAILED || state === State.EXPIRED || state === State.CONNECTED_READ_ONLY) {
				reject(new Error(`Zookeeper connection failed: ${state.code}`));
			}
		});
		client.connect();
	});
	const timeoutPromise = new Promise<Client>((_, reject) => {
		setTimeout(() => reject("timeout"), options?.sessionTimeout ?? 30000);
	});
	return Promise.race<Client>([connectClientPromise, timeoutPromise]);
}

function toZookeeperConfig(source: ZookeeperDataSource): { connectionString: string; options?: Partial<Option> } {
	const connectionString = source.hosts
		.map((host) => {
			let hostString = host.host + ":" + host.port;
			if (host.path) {
				hostString += host.path;
			}
			return hostString;
		})
		.join(",");
	const result: { connectionString: string; options?: Partial<Option> } = { connectionString };
	if (source.option) {
		result.options = {
			sessionTimeout: source.option.timeout,
			retries: source.option.retries,
		};
	}
	return result;
}
