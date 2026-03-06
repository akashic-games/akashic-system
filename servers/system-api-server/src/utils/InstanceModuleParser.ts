import * as Cast from "@akashic/cast-util";
import * as dt from "@akashic/server-engine-data-types";

export interface PlaylogWorkerParameter {
	playId?: string;
}

export interface VideoPublisherParameter {
	videoPublishUri?: string;
	videoFrameRate?: number;
}

/**
 * インスタンスモデルのモジュール解析器
 */
export namespace InstanceModuleParser {
	export function parsePlaylogWorker(mod: dt.InstanceModule): PlaylogWorkerParameter {
		const result: PlaylogWorkerParameter = {};
		if (!mod.values) {
			return result;
		}

		if (mod.code === "staticPlaylogWorker" && mod.values.playlog) {
			try {
				result.playId = Cast.bigint(mod.values.playlog.playId, true);
			} catch (error) {
				// 異常判定は外部にて行う:
				result.playId = undefined;
			}
		}
		if (mod.code === "dynamicPlaylogWorker") {
			try {
				result.playId = Cast.bigint(mod.values.playId, true);
			} catch (error) {
				// 異常判定は外部にて行う:
				result.playId = undefined;
			}
		}
		return result;
	}

	export function parseVideoPublisher(mod: dt.InstanceModule): VideoPublisherParameter {
		const result: VideoPublisherParameter = {};
		if (!mod.values) {
			return result;
		}

		if (mod.code === "videoPublisher") {
			try {
				result.videoPublishUri = Cast.string(mod.values.videoPublishUri, 512, true);
				result.videoFrameRate = Cast.int(mod.values.videoFrameRate, true);
			} catch (error) {
				// 異常判定は外部にて行う:
				result.videoPublishUri = undefined;
				result.videoFrameRate = undefined;
			}
		}
		return result;
	}

	/**
	 * イベントハンドラの解析
	 */
	export function parseEventHandler(mod: dt.InstanceModule): dt.EventHandler[] {
		let result: dt.EventHandler[];
		if (!mod.values) {
			return result;
		}

		if (mod.code === "eventHandlers") {
			const handlers: any[] = mod.values.handlers;
			try {
				result = handlers.map((value) => dt.EventHandler.fromObject(value));
			} catch (error) {
				result = undefined;
			}
		}
		return result;
	}

	export function validatePlaylogWorker(parameter: PlaylogWorkerParameter): boolean {
		return parameter && parameter.playId != null;
	}

	export function validateVideoPublisher(parameter: VideoPublisherParameter): boolean {
		return parameter && parameter.videoPublishUri != null && parameter.videoFrameRate != null;
	}

	export function validateEventHandler(parameter: dt.EventHandlerLike[]): boolean {
		return parameter && Array.isArray(parameter);
	}
}
