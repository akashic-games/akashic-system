import { ProcessClient, Processes, Process } from "@akashic/cluster-monitor-api-client";
import { NicoApiResponse } from "@akashic/rest-client-core";
import { Request, Response } from "express";
import { CreatePagenationInfo } from "../../../utils/Page";

interface ProcessOverview extends Process {
	isNormal: boolean;
	formattedTrait: string;
}
export class ProcessesController {
	private client: ProcessClient;

	constructor(client: ProcessClient) {
		this.client = client;
	}

	public async get(req: Request, res: Response, next: Function): Promise<void> {
		const page = Number(req.query.page) || 1;
		const pageSize = Number(req.query.pageSize) || 100;
		const param: { [key: string]: any } = {};
		const keys = Object.keys(req.query);
		keys.map((key) => (param[key] = global.decodeURI(req.query[key] as string)));
		param._offset = pageSize * (page - 1);
		param._limit = pageSize;
		param._count = 1;
		const hostname = param.host !== undefined ? String(param.host) : "";
		try {
			const processes = await this.client.getProcesses(param as any);
			const processOverviews: ProcessOverview[] = processes.data.values.map((process) => {
				return {
					...process,
					isNormal: process.mode === "normal",
					formattedTrait: process.trait.join(","),
				};
			});

			const sortedProcessOverviews = processOverviews.sort((processA, processB) => {
				if (processA.processName > processB.processName) return 1;
				if (processA.processName < processB.processName) return -1;
				return 0;
			});

			return res.render(
				"processes",
				Object.assign(
					{
						processes: sortedProcessOverviews,
						totalCount: processes.data.totalCount || 0,
						host: hostname,
						pageSize,
						helpers: {
							selectedPageSize: (n: number): string => {
								return n === pageSize ? "selected" : "";
							},
						},
					},
					CreatePagenationInfo(Math.ceil(processes.data.totalCount / pageSize), page),
				),
			);
		} catch (error) {
			next(error);
		}
	}

	public async post(req: Request, res: Response, next: Function): Promise<void> {
		// パラメータ検証
		if (req.query.host === undefined) {
			next(new Error("Invalid Parameter"));
		}
		const hostname = req.query.host;
		const param: { [key: string]: any } = { host: hostname, limit: 100 };

		// 対象ホストのプロセス一覧を取得してくる
		const response: NicoApiResponse<Processes> = await this.client.getProcesses(param).catch((error) => next(error));
		const mode = req.body.all_standby !== undefined ? "standby" : "normal";
		// modeを一括で変更
		await response.data.values.map(async (process: Process) => await this.client.putProcessMethod(process.processName, mode));
		// /hosts に設置されたボタンからPOSTされた場合にページ遷移を防ぐ
		if (req.query.from === "hosts") res.redirect("/hosts");
		else res.redirect("/processes?host=" + hostname);
	}
}
