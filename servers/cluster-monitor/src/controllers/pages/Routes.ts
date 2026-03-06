import { Controller } from "@akashic/akashic-rest-commons";
import { HostInfoClient, PlaylogServerHostInfoClient, PlaylogServerInfoClient, ProcessClient } from "@akashic/cluster-monitor-api-client";
import { SystemApiClient } from "@akashic/system-api-client";
import { InstanceClient, PlayClient } from "@akashic/system-control-api-client";
import { Request, Response } from "express";
import { SummaryController } from "./cluster/SummaryController";
import HostsController from "./hosts/HostsController";
import PlaylogServerHostsController from "./hosts/PlaylogServerHostsController";
import { InstanceController } from "./instances/InstanceController";
import { InstancesController } from "./instances/InstancesController";
import { PlaylogServersController } from "./playlogServers/PlaylogServersController";
import { PlayController } from "./plays/PlayController";
import { PlaysController } from "./plays/PlaysController";
import { ProcessController } from "./processes/ProcessController";
import { ProcessesController } from "./processes/ProcessesController";
import { ReportController } from "./reports/ReportController";
import { ReportsController } from "./reports/ReportsController";
import { SearchInstancesController } from "./search/SearchInstancesController";
import { SearchPlaysController } from "./search/SearchPlaysController";
import { SearchReportsController } from "./search/SearchReportsController";

export function create(
	systemApiClient: SystemApiClient,
	instanceClient: InstanceClient,
	playClient: PlayClient,
	processClient: ProcessClient,
	hostInfoClient: HostInfoClient,
	playlogServerHostInfoClient: PlaylogServerHostInfoClient,
	playlogServerInfoClient: PlaylogServerInfoClient,
) {
	const routes: { [key: string]: Controller } = {
		"/": new (class {
			public get(_req: Request, res: Response) {
				res.redirect("/cluster");
			}
		})(),
		"/instances": new InstancesController(instanceClient, processClient),
		"/instances/:id": new InstanceController(systemApiClient, instanceClient),
		"/plays": new PlaysController(playClient),
		"/plays/:id": new PlayController(playClient),
		"/processes": new ProcessesController(processClient),
		"/processes/:name": new ProcessController(processClient),
		"/hosts": new HostsController(hostInfoClient, processClient),
		"/playlog_server_hosts": new PlaylogServerHostsController(playlogServerHostInfoClient, playlogServerInfoClient),
		"/reports": new ReportsController(systemApiClient),
		"/reports/:id": new ReportController(systemApiClient),
		"/search/instances": new SearchInstancesController(),
		"/search/plays": new SearchPlaysController(),
		"/search/reports": new SearchReportsController(),
		"/cluster": new SummaryController(processClient),
		"/playlog/servers": new PlaylogServersController(playlogServerInfoClient),
	};
	return routes;
}
