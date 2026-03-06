import { DatabaseConfig } from "../connections/DatabaseConfig";

const ENV_NAME = "SERVICE_NAME"; // 設定を変える特殊関数名

export interface Config {
	get<T>(configName: string): T;
}
/**
 * DatabaseConfig定数専用のloader
 */
export class DatabaseConfigLoader {
	private _config: Config;
	constructor(config: Config) {
		this._config = config;
	}
	/**
	 * configからconfigNameを使用して定数を読み出す
	 * 対象となる環境変数が設定されている場合は、設定を変更する
	 */
	public load(configName: string): DatabaseConfig {
		const result = this._config.get<DatabaseConfig>(configName);
		if (process.env[ENV_NAME]) {
			// 特殊な環境変数がセットされている場合は接続先DB名を変更
			result.database += "_" + process.env[ENV_NAME];
		}
		return result;
	}
}
