import { ExcludedProcess as ExcludedProcessRepository } from "../repositories/ExcludedProcess";
import { Instance as InstanceRepository } from "../repositories/Instance";
import { InstanceAssignment as InstanceAssignmentRepository } from "../repositories/InstanceAssignment";
import { InstanceEventHandler as InstanceEventHandlerRepository } from "../repositories/InstanceEventHandler";
import { Play as PlayRepository } from "../repositories/Play";
import { PlaysInstances as PlaysInstancesRepository } from "../repositories/PlaysInstances";
import { PlaysNicoliveMetadata as PlaysNicoliveMetadataRepository } from "../repositories/PlaysNicoliveMetadata";
import { Process as ProcessRepository } from "../repositories/Process";
import { Report as ReportRepository } from "../repositories/Report";
import { ServerEngineMaster as ServerEngineMasterRepository } from "../repositories/ServerEngineMaster";
import { VideoSetting as VideoSettingRepository } from "../repositories/VideoSetting";
import { ConnectionFactory } from "./ConnectionFactory";

export class Repositories {
	private _instance: InstanceRepository;
	private _instanceAssignment: InstanceAssignmentRepository;
	private _process: ProcessRepository;
	private _serverEngineMaster: ServerEngineMasterRepository;
	private _play: PlayRepository;
	private _playsInstances: PlaysInstancesRepository;
	private _playsNicoliveMetadata: PlaysNicoliveMetadataRepository;
	private _report: ReportRepository;
	private _videoSetting: VideoSettingRepository;
	private _instanceEventHandler: InstanceEventHandlerRepository;
	private _excludedProcess: ExcludedProcessRepository;

	get instance(): InstanceRepository {
		return this._instance;
	}
	get instanceAssignment(): InstanceAssignmentRepository {
		return this._instanceAssignment;
	}
	get process(): ProcessRepository {
		return this._process;
	}
	get serverEngineMaster(): ServerEngineMasterRepository {
		return this._serverEngineMaster;
	}
	get play(): PlayRepository {
		return this._play;
	}
	get playsInstances(): PlaysInstancesRepository {
		return this._playsInstances;
	}
	get playsNicoliveMetadata(): PlaysNicoliveMetadataRepository {
		return this._playsNicoliveMetadata;
	}
	get report(): ReportRepository {
		return this._report;
	}
	get videoSetting(): VideoSettingRepository {
		return this._videoSetting;
	}
	get instanceEventHandler(): InstanceEventHandlerRepository {
		return this._instanceEventHandler;
	}
	get excludedProcess(): ExcludedProcessRepository {
		return this._excludedProcess;
	}
	constructor(factory: ConnectionFactory) {
		this._instance = new InstanceRepository(factory);
		this._instanceAssignment = new InstanceAssignmentRepository(factory);
		this._process = new ProcessRepository(factory);
		this._serverEngineMaster = new ServerEngineMasterRepository(factory);
		this._play = new PlayRepository(factory);
		this._playsInstances = new PlaysInstancesRepository(factory);
		this._playsNicoliveMetadata = new PlaysNicoliveMetadataRepository(factory);
		this._report = new ReportRepository(factory);
		this._videoSetting = new VideoSettingRepository(factory);
		this._instanceEventHandler = new InstanceEventHandlerRepository(factory);
		this._excludedProcess = new ExcludedProcessRepository(factory);
	}
}
