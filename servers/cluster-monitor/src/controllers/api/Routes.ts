import { Controller } from "@akashic/akashic-rest-commons";
import { ProcessClient } from "@akashic/cluster-monitor-api-client";
import { DispatchingRedis } from "@akashic/dispatching-core";
import { SystemApiClient } from "@akashic/system-api-client";
import { InstanceClient, PlayClient } from "@akashic/system-control-api-client";
import { ExcludePlaylogController } from "./admin/ExcludePlaylogController";
import { DeleteInstanceController } from "./admin/InstanceController";
import { DeletePlayController, PlaylogController, StartPlayController } from "./admin/PlayController";
import { ProcessController } from "./admin/ProcessController";

export function create(
	systemApiClient: SystemApiClient,
	instanceClient: InstanceClient,
	playClient: PlayClient,
	processClient: ProcessClient,
	admin: boolean,
	dispatchingRedis: DispatchingRedis,
) {
	const routes: { [key: string]: Controller } = {
		"/delete/instances/:id": new DeleteInstanceController(instanceClient, admin),
		"/delete/plays/:id": new DeletePlayController(playClient, admin),
		"/start/plays/:id": new StartPlayController(systemApiClient, admin),
		"/playlog/:id": new PlaylogController(systemApiClient, admin),
		"/exclude/playlog/:trait/:processId": new ExcludePlaylogController(dispatchingRedis, admin),
		"/exclude/processes/:processName": new ProcessController(processClient, admin),
	};
	return routes;
}
