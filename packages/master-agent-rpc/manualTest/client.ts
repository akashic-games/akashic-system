import * as RPC from "../src";
import * as dt from "@akashic/server-engine-data-types";

let client = new RPC.ProcessToMasterClient({ host: "10.141.0.212", port: 37564, timeout: 1000 });
let func = () => {
	client
		.join({
			clusterIdentity: new dt.ClusterIdentity({
				fqdn: new dt.Fqdn("example.com"),
				type: "gameRunner2",
				name: "0",
				czxid: "123",
			}),
			port: 1234,
			machineValues: {
				graphicsType: "NONE",
			},
		})
		.then(() => {
			console.log("joined");
		})
		.catch((err) => console.log(err.stack))
		.then(() => {
			setTimeout(function (): void {
				func();
			}, 1000);
		});
};
func();
