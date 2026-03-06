export interface ZookeeperDataSource {
	hosts: ZookeeperHost[];
	option?: ZookeeperOption;
}

export interface ZookeeperHost {
	host: string;
	port: number;
	path?: string;
}

/**
 * zookeeper.ZookeeperConfig 互換のオプション
 *
 */
export interface ZookeeperOption {
	timeout?: number;
	retries?: number;
}
