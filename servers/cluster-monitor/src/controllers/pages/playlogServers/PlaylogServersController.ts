import { PlaylogServerInfoClient, PlaylogServer, PlaylogServerSessionClient } from "@akashic/cluster-monitor-api-client";
import { Request, Response } from "express";

interface PlaylogServerOverview extends PlaylogServer {
	isStandby: boolean;
	numSessions: number;
}

// playlog server list controller
export class PlaylogServersController {
	private client: PlaylogServerInfoClient;

	constructor(playlogServerInfoClient: PlaylogServerInfoClient) {
		this.client = playlogServerInfoClient;
	}

	public async get(req: Request, res: Response, next: Function) {
		const condition: { hostname?: string } = {};
		if (req.query.host !== undefined) {
			condition.hostname = req.query.host as string;
		}
		try {
			const playlogServers = await this.client.getPlaylogServers(condition);
			const playlogSessions = await Promise.allSettled(
				playlogServers.data.values.map((playlogServer: PlaylogServer) => {
					const _client = new PlaylogServerSessionClient(playlogServer.reservationEndpoint);
					return _client.getSessionInfo();
				}),
			);
			// 「死活監視上は存在するがunreachableなもの」はカウントしない
			const sessionCountList: number[] = playlogSessions.map((_res) => {
				return _res.status === "fulfilled" ? _res.value.data?.length : 0;
			});
			const playlogServerOverviews: PlaylogServerOverview[] = playlogServers.data.values.map((playlogServer: PlaylogServer, idx) => {
				return {
					...playlogServer,
					isStandby: playlogServer.mode === "standby",
					numSessions: sessionCountList[idx],
				};
			});

			const sortedPlaylogServerOverviews = playlogServerOverviews.sort((playlogServerA, playlogServerB) => {
				if (playlogServerA.id > playlogServerB.id) {
					return 1;
				} else if (playlogServerA.id < playlogServerB.id) {
					return -1;
				} else {
					return 0;
				}
			});

			res.status(200).render("playlog/servers", {
				host: condition.hostname,
				playlogServerOverviews: sortedPlaylogServerOverviews,
				totalCount: sortedPlaylogServerOverviews.length,
			});
		} catch (error) {
			next(error);
		}
	}

	public async post(req: Request, res: Response, next: Function): Promise<void> {
		// パラメータ検証
		if (req.query.host === undefined) {
			next(new Error("Invalid Parameter"));
		}
		const hostname = req.query.host as string;

		// 対象ホストのプロセス一覧を取得してくる
		const playlogServers = await this.client.getPlaylogServers({ hostname }).catch((error) => next(error));
		const mode = req.body.all_standby !== undefined ? "standby" : "normal";
		// modeを一括で変更
		await playlogServers.data.values.map(
			async (playlogServer: PlaylogServer) => await this.client.putPlaylogServerMode(playlogServer.id, mode),
		);
		res.redirect("/playlog/servers?host=" + hostname);
	}
}
