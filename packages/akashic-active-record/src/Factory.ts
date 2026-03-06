import * as dt from "@akashic/server-engine-data-types";

export function createPlay(gameCode: string, status: string): dt.Play {
	return new dt.Play({
		gameCode,
		parentId: "1",
		started: new Date(),
		status,
	});
}

export function createInstance(gameCode: string, status: string): dt.Instance {
	return new dt.Instance({
		gameCode,
		modules: [
			{
				code: "dummyModule",
				values: {},
			},
		],
		status,
		region: "akashicCluster",
		cost: 10,
		processName: "spec-process",
		entryPoint: "/data/spec/entry.js",
	});
}

export interface CreateInstanceParams {
	gameCode: string;
	status: string;
	cost: number;
	processName: string;
	entryPoint: string;
}

export function createInstances(params: CreateInstanceParams[]) {
	return params.map((value) => {
		return new dt.Instance({
			gameCode: value.gameCode,
			modules: [
				{
					code: "dummyModule",
					values: {},
				},
			],
			status: value.status,
			region: "akashicCluster",
			cost: 10,
			processName: value.processName,
			entryPoint: value.entryPoint,
		});
	});
}

export function createInstanceAssignment(gameCode: string): dt.InstanceAssignment {
	return new dt.InstanceAssignment({
		gameCode,
		targetIdentity: {
			fqdn: new dt.Fqdn("foobar.example.com"),
			type: "gameRunner",
			name: "1",
			czxid: "1",
		},
		targetPort: 8080,
		instanceId: "1",
		entryPoint: "akashic/v1.0/entry.js",
		requirement: 10,
		modules: [],
	});
}

export function createProcess(): dt.Process {
	return new dt.Process({
		clusterIdentity: {
			fqdn: new dt.Fqdn("foobar.example.com"),
			type: "gameRunner",
			name: "1",
			czxid: "1",
		},
		port: 12345,
		machineValues: {},
	});
}
