import * as activeRecord from "@akashic/akashic-active-record";
import * as dt from "@akashic/server-engine-data-types";
import * as os from "os";
import { AppConfig, Timeout } from "../configs";
import { MasterStatus } from "../core";
import { CallbackPublisher } from "../util/CallbackPublisher";
import { LogFactory } from "../util/LogFactory";
import { Mutex } from "../util/Mutex";
import { StatusUpdater } from "../util/StatusUpdater";
import { BootResult } from "./BootResult";
import { ProcessConnections } from "./connections/ProcessConnections";
import { ProcessToMasterServer } from "./connections/ProcessToMasterServer";
import { ErrorProcessor } from "./controls/ErrorProcessor";
import { InstanceManager } from "./controls/InstanceManager";
import { ProcessAcceptor } from "./controls/ProcessAcceptor";
import { ProcessMonitor } from "./controls/ProcessMonitor";
import { InstanceRequestConsumer } from "./instanceRequests/InstanceRequestConsumer";
import { BootQueue } from "./queues/BootQueue";
import { InstanceRequestQueue } from "./queues/InstanceRequestQueue";
import { InstanceAssignmentRepository } from "./repositories/InstanceAssignmentRepository";
import { ProcessRepository } from "./repositories/ProcessRepository";
import { AssignmentResolver } from "./taskAssignments/AssignmentResolver";
import { BootRequestConsumer } from "./taskAssignments/BootRequestConsumer";

type Core = import("../core").Core;

/**
 * master起動処理
 */
export class Bootstrap {
	private _masterEndpoint: dt.Endpoint;
	private _clusterCore: Core;
	private _logFactory: LogFactory;
	private _bootQueue: BootQueue;
	private _instanceRequestQueue: InstanceRequestQueue;
	private _assignmentResolver: AssignmentResolver;
	private _bootRequestConsumer: BootRequestConsumer;
	private _instanceRequestConsumer: InstanceRequestConsumer;
	private _processMonitor: ProcessMonitor;
	private _database: activeRecord.Database;
	private _instanceManager: InstanceManager;
	private _errorProcessor: ErrorProcessor;
	private _publisher: CallbackPublisher;
	private _updater: StatusUpdater;
	private _processToMasterServer: ProcessToMasterServer;
	private _processConnections: ProcessConnections;
	private _isBooted = false;
	constructor(
		clusterCore: Core,
		appConfig: AppConfig,
		database: activeRecord.Database,
		publisher: CallbackPublisher,
		logFactory: LogFactory,
		timeout: Timeout,
	) {
		this._clusterCore = clusterCore;
		this._logFactory = logFactory;
		this._database = database;
		this._publisher = publisher;
		this._updater = new StatusUpdater(database, publisher);
		this.resolveDependencyInjection(appConfig, timeout);
	}
	public async boot(): Promise<BootResult> {
		if (this._isBooted) {
			return Promise.reject(new Error("すでに起動済みです"));
		}
		this._isBooted = true;
		const log = this._logFactory.getLogger("out");
		log.info("起動処理を実施します");
		await this.promoteMaster(); // 昇格を実施する。masterになれるまでここから進まない
		log.info("masterとしての起動処理を開始します");
		this._bootRequestConsumer.connect();
		this._instanceRequestConsumer.connect(); // リクエストキューをつなぐ
		log.info("zookeeperのプロセス監視を開始します");
		await this._processMonitor.connect(); // zookeeperのプロセス監視を作動させて、現在のプロセス稼働状況を同期する
		await this._processMonitor.syncDatabase(); // 稼働状況とつきつけ合わせてDBを同期させる
		this._processToMasterServer.listen(); // processからの受付サーバをオープンする
		log.info("masterとしての起動処理が完了しました");
		log.info("起動が完了しました");
		return { instanceManager: this._instanceManager };
	}
	private resolveDependencyInjection(appConfig: AppConfig, timeout: Timeout) {
		this._bootQueue = new BootQueue();
		this._instanceRequestQueue = new InstanceRequestQueue();
		this._masterEndpoint = new dt.Endpoint({
			fqdn: new dt.Fqdn(os.hostname()),
			port: appConfig.process.acceptPort,
		});
		this._instanceManager = new InstanceManager(
			this._database,
			this._bootQueue,
			this._instanceRequestQueue,
			this._updater,
			this._publisher,
			this._logFactory.getLogger("out"),
		);
		this._errorProcessor = new ErrorProcessor(
			this._instanceManager,
			this._database.repositories.instance,
			this._clusterCore.masterController,
			this._publisher,
		);
		this._processConnections = new ProcessConnections(timeout);
		const processRepository = new ProcessRepository(this._database);
		const instanceAssignmentRepository = new InstanceAssignmentRepository(this._database);
		this._processMonitor = new ProcessMonitor(
			this._clusterCore,
			processRepository,
			instanceAssignmentRepository,
			this._errorProcessor,
			this._logFactory,
		);
		const processAcceptor = new ProcessAcceptor(processRepository, this._processMonitor);
		this._processToMasterServer = new ProcessToMasterServer(
			appConfig.process.acceptPort,
			processAcceptor,
			this._clusterCore.masterController,
			this._instanceManager,
			this._errorProcessor,
			this._logFactory,
		);
		this._assignmentResolver = new AssignmentResolver(
			processRepository,
			instanceAssignmentRepository,
			this._processConnections,
			this._logFactory,
		);
		const mutex = new Mutex();
		this._bootRequestConsumer = new BootRequestConsumer(
			this._bootQueue,
			this._assignmentResolver,
			this._updater,
			this._logFactory,
			this._database.repositories.instance,
			mutex,
		);
		this._instanceRequestConsumer = new InstanceRequestConsumer(
			this._instanceRequestQueue,
			instanceAssignmentRepository,
			this._processConnections,
			this._logFactory,
			mutex,
			this._updater,
		);
	}
	/**
	 * masterへの昇格を行う。submasterの場合は昇格/エラーになるまで待機する
	 */
	private promoteMaster(): Promise<void> {
		const log = this._logFactory.getLogger("out");
		log.trace("masterの昇格を試みます");
		return new Promise<void>((resolve, reject) => {
			const callback = (status: MasterStatus) => {
				if (status === MasterStatus.master) {
					log.info("masterに昇格しました");
					this._clusterCore.masterController.removeListener("masterStatusChanged", callback);
					resolve();
				} else if (status === MasterStatus.subMaster) {
					log.info("submasterとして待機します");
				} else if (status === MasterStatus.fatal) {
					this._clusterCore.masterController.removeListener("masterStatusChanged", callback);
					reject(new Error("fatalになったのでsubmaster待機を終了します"));
				}
			};
			this._clusterCore.masterController.addListener("masterStatusChanged", callback);
			this._clusterCore.masterController
				.tryGetMasterPost(this._masterEndpoint)
				.then((result) => {
					if (result) {
						log.info("masterに昇格しました");
						resolve(undefined);
						this._clusterCore.masterController.removeListener("masterStatusChanged", callback);
					}
					// submaster時の処理は上記で処理される
				})
				.catch((err) => reject(err));
		});
	}
}
