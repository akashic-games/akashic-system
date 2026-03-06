import { LogUtil } from "@akashic/log-util";
import * as amqp from "amqplib";

export interface AMQPConfiguration {
	url: string | string[];
	user: string;
	passwd: string;
}

export class AMQPConnectionFactory {
	private _urls: string[];
	private _credentials: ReturnType<typeof amqp.credentials.plain>;
	private _urlIndex: number;
	private _logger: LogUtil;

	constructor(config: AMQPConfiguration, logger: LogUtil) {
		if (config.user && config.passwd) {
			this._credentials = amqp.credentials.plain(config.user, config.passwd);
		}
		if (Array.isArray(config.url)) {
			this._urls = config.url as string[];
		} else {
			this._urls = [config.url as string];
		}
		this._urlIndex = 0;
		this._logger = logger;
	}

	public newConnection(): Promise<amqp.ChannelModel> {
		const url = this._urls[this._urlIndex];
		this._urlIndex = (this._urlIndex + 1) % this._urls.length;
		this._logger.info("trying to connect amqp server: " + url);
		return amqp.connect(url, { credentials: this._credentials });
	}
}
