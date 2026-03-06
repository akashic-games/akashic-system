// ReportClient が export * で宣言されているため、こちら側で明示的に名前付けする必要がある
import { ILogger } from "@akashic-system/logger";

// logger は使っているため、削除はできない。
// 将来的に、DIコンテナにする。
export default class SystemControlClient {
	public readonly logger: ILogger;

	constructor(logger: ILogger) {
		this.logger = logger;
	}
}
