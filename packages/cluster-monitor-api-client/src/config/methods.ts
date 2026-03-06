const methods = {
	process: {
		getClusterSummary: {
			path: "/clusters/akashic",
			method: "GET",
		},
		getProcesses: {
			path: "/clusters/akashic/processes?host=:host&type=:type&_offset=:_offset&_limit=:_limit&_count=:_count",
			method: "GET",
		},
		getProcess: {
			path: "/clusters/akashic/processes/:name",
			method: "GET",
		},
		getInstances: {
			path: "/clusters/akashic/processes/:name/instances",
			method: "GET",
		},
		putProcessMode: {
			path: "/clusters/akashic/processes/:name",
			method: "PUT",
		},
	},
	playlog: {
		getPlaylogServers: {
			path: "/clusters/akashic/playlog/servers?hostname=:hostname&trait=:trait",
			method: "GET",
		},
		putPlaylogServerMode: {
			path: "/clusters/akashic/playlog/mode",
			method: "PUT",
		},
	},
	host: {
		getHosts: {
			path: "/clusters/akashic/hosts",
			method: "GET",
		},
	},
	playlogServerHost: {
		getPlaylogServerHosts: {
			path: "/clusters/akashic/playlog_server_hosts",
			method: "GET",
		},
	},
};
export = methods;
