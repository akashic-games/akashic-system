// zookeeper-clientのコピー。
// コピーする理由はzookeeper-client.d.tsの隠蔽のため
// 外に出す物に参照しちゃうとnode-zookeeper-client.d.tsまで利用側が参照しなきゃいけなくなるため
/**
 * zookeeper設定
 */
export interface ZookeeperConfig {
	hosts: ZookeeperHost[];
	options?: ZookeeperOptions;
}

/**
 * zookeeper各種設定
 */
export interface ZookeeperOptions {
	timeout?: number;
	retries?: number;
}
export interface ZookeeperHost {
	host: string;
	port: number;
	path?: string;
}
