import * as Cast from "@akashic/cast-util";
import { Annotations } from "@akashic/tapper";

export class InstanceEventHandler {
	@Annotations.map()
	public instanceId: string;

	@Annotations.map()
	public eventHandlerId: string;

	constructor(instanceId: string, eventHandlerId: string) {
		this.instanceId = Cast.bigint(instanceId);
		this.eventHandlerId = Cast.bigint(eventHandlerId);
	}
}
