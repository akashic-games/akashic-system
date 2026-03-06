import * as restCommons from "@akashic/akashic-rest-commons";
import { InstanceController } from "./instances/InstanceController";
import { MasterStateController } from "./master/MasterStateController";

export function getRouteSettings(
	instanceManager: import("./master/controls/InstanceManager").InstanceManager,
	masterController: import("./core").MasterController,
) {
	// routing設定
	const routes: { [key: string]: restCommons.Controller } = {
		"/v1.0/instances/:id": new InstanceController(instanceManager),
		"/v1.0/master/state": new MasterStateController(masterController),
	};
	return routes;
}
