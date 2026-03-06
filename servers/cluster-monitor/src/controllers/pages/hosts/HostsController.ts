import { HostInfoClient, ProcessClient } from "@akashic/cluster-monitor-api-client";
import { Request, Response } from "express";

export default class HostsController {
	private readonly hostInfoClient: HostInfoClient;
	private readonly processClient: ProcessClient;

	constructor(hostInfoClient: HostInfoClient, processClient: ProcessClient) {
		this.hostInfoClient = hostInfoClient;
		this.processClient = processClient;
	}

	public async get(_req: Request, res: Response, next: Function): Promise<void> {
		type hostInfo = {
			host: string;
			normalProcessCount: number;
			standbyProcessCount: number;
		};
		try {
			const hosts = await this.hostInfoClient.getHosts();
			const hostInfo: hostInfo[] = [];
			let normalProcessTotalCount = 0;
			let standbyProcessTotalCount = 0;

			for (const host of Object.assign(hosts.data.values)) {
				const processes = await this.processClient.getProcesses({ host });
				const isNormalProcess: boolean[] = processes.data.values.map((process) => {
					return process.mode === "normal";
				});
				const normalProcessCount = isNormalProcess.filter((isNormal) => {
					return isNormal;
				}).length;
				const standbyProcessCount = isNormalProcess.filter((isNormal) => {
					return !isNormal;
				}).length;
				hostInfo.push({ host, normalProcessCount, standbyProcessCount });
				normalProcessTotalCount += normalProcessCount;
				standbyProcessTotalCount += standbyProcessCount;
			}

			const sortedHostInfo = hostInfo.sort((hostInfoA, hostInfoB) => {
				if (hostInfoA.host > hostInfoB.host) return 1;
				if (hostInfoA.host < hostInfoB.host) return -1;
				return 0;
			});

			const totalCounts = {
				host: hosts.data.totalCount,
				normalProcess: normalProcessTotalCount,
				standbyProcess: standbyProcessTotalCount,
			};

			return res.render("hosts", {
				hostInfo: sortedHostInfo,
				totalCounts,
			});
		} catch (error) {
			next(error);
		}
	}
}
