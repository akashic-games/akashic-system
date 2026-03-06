import { ILogger } from "@akashic-system/logger";
import { Handler } from "express";

const RESPONSE_DELAY_THRESHOLD = 3000; // 3秒で警告
const RESPONSE_TIMEOUT_THRESHOLD = 50000; // 50秒でエラー
const MAX_WAIT = 180000; // 3分以上は待たない

export function detectResponseTimeoutMiddleware(logger: ILogger): Handler {
	return (req, res, next) => {
		const url = req.url;
		const start = Date.now();
		const timer = setTimeout(() => {
			logger.error(`DetectResponseTimeoutMiddleware: detect no response sent. url: ${url}`);
		}, MAX_WAIT);
		res.on("finish", () => {
			clearTimeout(timer);
			const elapsed = Date.now() - start;
			if (elapsed > RESPONSE_DELAY_THRESHOLD) {
				logger.warn(`DetectResponseTimeoutMiddleware: detect response delay: ${elapsed}ms url: ${url}`);
			} else if (elapsed > RESPONSE_TIMEOUT_THRESHOLD) {
				logger.error(`DetectResponseTimeoutMiddleware: detect response timeout: ${elapsed}ms url: ${url}`);
			}
		});
		next();
	};
}
