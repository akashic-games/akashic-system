import restCommons = require("@akashic/akashic-rest-commons");
import { Cluster } from "../repositories/Cluster";
import ClusterSummaryController = require("./cluster/SummaryController");
import GameRunnerHostsController from "./host/GameRunnerHostsController";
import PlaylogServerHostsController from "./host/PlaylogServerHostsController";
import PlaylogExcludedController from "./playlog/PlaylogExcludedController";
import PlaylogModeController from "./playlog/PlaylogModeController";
import PlaylogServersController from "./playlog/PlaylogServersController";
import PlaylogSessionInfoController from "./playlog/PlaylogSessionInfoController";
import InstancesController = require("./process/InstancesController");
import ProcessController = require("./process/ProcessController");
import ProcessesController = require("./process/ProcessesController");
import { createProcessRepository } from "../repositories/ProcessRepository";
import { createInstanceRepository } from "../repositories/InstanceRepository";
import { ProcessService } from "../services/ProcessService";
import { InstanceService } from "../services/InstanceService";

//
import type { Database } from "@akashic/akashic-active-record";
import type { ReadOnlyAliveMonitoring, ZookeeperRepository } from "@akashic/alive-monitoring-core";
import type { RedisCommander } from "ioredis";
import type { ProcessRepository, InstanceRepository } from "../repositories/Repository";

function create(
	database: Database,
	aliveMonitoring: ReadOnlyAliveMonitoring,
	zkRepository: ZookeeperRepository,
	redisRepository: RedisCommander,
) {
	const cluster: Cluster = new Cluster(database, zkRepository);
	const processRepository: ProcessRepository = createProcessRepository(database);
	const instanceRepository: InstanceRepository = createInstanceRepository(database);
	const processService: ProcessService = new ProcessService(processRepository, zkRepository);
	const instanceService: InstanceService = new InstanceService(instanceRepository);

	// routing設定
	const routes: { [key: string]: restCommons.Controller } = {
		"/clusters/akashic": new ClusterSummaryController(cluster),
		"/clusters/akashic/playlog/servers": new PlaylogServersController(aliveMonitoring, redisRepository),
		"/clusters/akashic/playlog/status": new PlaylogSessionInfoController(redisRepository),
		"/clusters/akashic/playlog/excluded": new PlaylogExcludedController(redisRepository),
		"/clusters/akashic/playlog/mode": new PlaylogModeController(redisRepository),
		"/clusters/akashic/processes": new ProcessesController(processService),
		"/clusters/akashic/processes/:processName": new ProcessController(processService),
		"/clusters/akashic/processes/:processName/instances": new InstancesController(instanceService),
		"/clusters/akashic/hosts": new GameRunnerHostsController(processService),
		"/clusters/akashic/playlog_server_hosts": new PlaylogServerHostsController(aliveMonitoring, redisRepository),
	};
	return routes;
}

export = create;
