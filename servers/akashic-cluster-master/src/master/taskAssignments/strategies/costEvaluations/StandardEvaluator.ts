import * as dt from "@akashic/server-engine-data-types";
import { BootQueueMessage } from "../../../queues/BootQueueMessage";
import { EvaluateResult } from "../dataTypes/EvaluateResult";
import { Requirement } from "../dataTypes/Requirement";
import { Evaluator } from "./Evaluator";

/**
 * 渡されたコストと動画出力情報をもとにコストをそのまま引き渡す通常Evaluator
 */
export class StandardEvaluator implements Evaluator {
	public evaluateCost(message: BootQueueMessage): Promise<EvaluateResult> {
		const cost: Requirement = new Requirement(
			dt.Constants.TYPE_GAME_RUNNER_2,
			message.cost,
			this.needVideo(message),
			message.assignmentConstraints ? message.assignmentConstraints.trait : undefined,
		);
		return Promise.resolve(new EvaluateResult(message, cost));
	}

	private needVideo(message: BootQueueMessage) {
		return message.modules.some((module) => module.code === "videoPublisher");
	}
}
