import * as amflow from "@akashic/amflow";
import * as amtp from "@akashic/amtplib";

export interface AssignedPushPipes {
	sendTick: amtp.PushPipe;
	subscribeTick: amtp.IncomingPushPipe;
	sendEvent: amtp.PushPipe;
	subscribeEvent: amtp.IncomingPushPipe;
}

export interface PushPipes {
	primary: amtp.PushPipe;
	secondary: amtp.PushPipe;
	incomingPrimary: amtp.IncomingPushPipe;
	incomingSecondary: amtp.IncomingPushPipe;
}

export class PushPipeHandler {
	private pipes: PushPipes;
	constructor(pipes: PushPipes) {
		this.pipes = pipes;
	}
	public assign(permission: amflow.Permission): AssignedPushPipes {
		const assigned: AssignedPushPipes = {
			sendTick: null,
			subscribeTick: null,
			sendEvent: null,
			subscribeEvent: null,
		};
		if (permission.writeTick) {
			assigned.sendTick = this.pipes.primary;
		}
		if (permission.sendEvent) {
			if (permission.writeTick) {
				assigned.sendEvent = this.pipes.secondary;
			} else {
				assigned.sendEvent = this.pipes.primary;
			}
		}
		if (permission.subscribeTick) {
			assigned.subscribeTick = this.pipes.incomingPrimary;
		}
		if (permission.subscribeEvent) {
			if (permission.subscribeTick) {
				assigned.subscribeEvent = this.pipes.incomingSecondary;
			} else {
				assigned.subscribeEvent = this.pipes.incomingPrimary;
			}
		}
		return assigned;
	}
	public destroy(): void {
		this.pipes = null;
	}
}
