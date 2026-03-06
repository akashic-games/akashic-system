export interface ClusterSummary {
	master: {
		host: string;
		port: number;
	};
	numProcesses: number;
	numInstances: number;
	capacity: {
		total: number;
		used: number;
	};
}

export interface Process {
	processName: string;
	type: string;
	host: string;
	port: number;
	czxid: string;
	capacity: number;
	videoEnabled: boolean;
	mode: string;
	status: any;
	trait: string[];
}

export interface Processes {
	values: Process[];
	totalCount?: number;
}

export interface PlaylogServer {
	id: string;
	trait: string;
	endpoint: string;
	numMaxClients: number;
	reservationEndpoint: string;
	mode: string;
	session: {
		reserved: number;
		started: number;
	};
}

export interface PlaylogServers {
	values: PlaylogServer[];
}

export interface PlaylogServerHostInfo {
	host: string;
	normalCount: number;
	standbyCount: number;
}

export interface PlaylogServerMode {
	sessionName: string;
	mode: string;
}

export interface PagingRequest {
	/**
	 * 結果一覧のoffset
	 */
	_offset?: number;
	/**
	 * 結果一覧の返却件数
	 */
	_limit?: number;
	/**
	 * 結果に総件数を付与するかのフラグ
	 */
	_count?: number;
}

export interface GetProcessesRequest extends PagingRequest {
	/**
	 * 取得対象のhost
	 */
	host?: string;
	/**
	 * 取得対象のtype
	 */
	type?: string;
}

export interface PlaylogServerSessionsResponse {
	id: string;
}
