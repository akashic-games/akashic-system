import type { InstanceRepository } from "../repositories/Repository";
import type * as ServerEngineDataTypes from "@akashic/server-engine-data-types";

export class InstanceService {
	private _instanceRepository: InstanceRepository;

	constructor(instanceRepository: InstanceRepository) {
		this._instanceRepository = instanceRepository;
	}

	public async getByName(name: string): Promise<ServerEngineDataTypes.InstanceAssignment[]> {
		return await this._instanceRepository.getByName(name);
	}
}
