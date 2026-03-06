import type { Request, Response } from "express";
import type { ProcessService } from "../../services/ProcessService";

export default class GameRunnerHostsController {
	private _processService: ProcessService;

	constructor(processService: ProcessService) {
		this._processService = processService;
	}

	public async get(_req: Request, res: Response, next: Function): Promise<any> {
		try {
			const response = await this._processService.getFqdn();
			return res.json(response);
		} catch (error) {
			next(error);
		}
	}
}
