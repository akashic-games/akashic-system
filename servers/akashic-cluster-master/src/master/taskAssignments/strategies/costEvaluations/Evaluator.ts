import { BootQueueMessage } from "../../../queues/BootQueueMessage";
import { EvaluateResult } from "../dataTypes/EvaluateResult";

/**
 * タスクとGameHub上のコストを評価して、実際に必要なコストを返すstrategy pattern
 */
export interface Evaluator {
	evaluateCost(message: BootQueueMessage): Promise<EvaluateResult>;
}
