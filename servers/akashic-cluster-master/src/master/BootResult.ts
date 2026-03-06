import { InstanceManager } from "./controls/InstanceManager";

/**
 * masterのboot後に処理するために渡す情報
 */
export interface BootResult {
	instanceManager: InstanceManager;
}
