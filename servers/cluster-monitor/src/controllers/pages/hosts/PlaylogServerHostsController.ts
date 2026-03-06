import {
	PlaylogServerHostInfoClient,
	PlaylogServerInfoClient,
	PlaylogServer,
	PlaylogServerHostInfo,
} from "@akashic/cluster-monitor-api-client";
import { Request, Response } from "express";
export default class PlaylogServerHostsController {
	private readonly playlogServerHostInfoClient: PlaylogServerHostInfoClient;
	private client: PlaylogServerInfoClient;

	constructor(playlogServerHostInfoClient: PlaylogServerHostInfoClient, playlogServerInfoClient: PlaylogServerInfoClient) {
		this.playlogServerHostInfoClient = playlogServerHostInfoClient;
		this.client = playlogServerInfoClient;
	}

	public async get(_req: Request, res: Response, next: Function): Promise<void> {
		try {
			const hosts = await this.playlogServerHostInfoClient.getPlaylogServerHosts();
			const sortedHosts: PlaylogServerHostInfo[] = hosts.data.values.sort((hostA: PlaylogServerHostInfo, hostB: PlaylogServerHostInfo) => {
				if (hostA.host > hostB.host) {
					return 1;
				} else if (hostA.host < hostB.host) {
					return -1;
				} else {
					return 0;
				}
			});

			let normalProcessTotalCount = 0;
			let standbyProcessTotalCount = 0;
			for (const host of sortedHosts) {
				normalProcessTotalCount += host.normalCount;
				standbyProcessTotalCount += host.standbyCount;
			}
			const totalCounts = {
				host: sortedHosts.length,
				normalProcess: normalProcessTotalCount,
				standbyProcess: standbyProcessTotalCount,
			};

			return res.render("playlog_server_hosts", {
				hosts: sortedHosts,
				totalCounts,
			});
		} catch (error) {
			next(error);
		}
	}

	public async post(req: Request, res: Response, next: Function): Promise<void> {
		// 対象ホストのプロセス一覧を取得してくる
		const playlogServers = await this.client.getPlaylogServers({ hostname: req.body.host }).catch((error) => next(error));
		const mode = req.body.all_standby !== undefined ? "standby" : "normal";
		// modeを一括で変更
		await playlogServers.data.values.map(
			async (playlogServer: PlaylogServer) => await this.client.putPlaylogServerMode(playlogServer.id, mode),
		);
		res.redirect("/playlog_server_hosts");
	}
}
