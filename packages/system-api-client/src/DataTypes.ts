export interface PagingResponse<T> {
	values: T[];
	totalCount?: number;
}

export interface EmptyResponse {}

export interface PagingRequest {
	[key: string]: any;
	_offset?: number;
	_limit?: number;
	_count?: number;
}

export interface Play {
	id: string;
	gameCode: string;
	parentId?: string;
	started: string;
	finished?: string;
	status: string;
}

export interface PlayTokenPermission {
	writeTick: boolean;
	readTick: boolean;
	subscribeTick: boolean;
	sendEvent: boolean;
	subscribeEvent: boolean;
	maxEventPriority: number;
}

export interface PlayTokenPermissionPartial {
	writeTick?: boolean;
	readTick?: boolean;
	subscribeTick?: boolean;
	sendEvent?: boolean;
	subscribeEvent?: boolean;
	maxEventPriority?: number;
}

export interface PlayToken {
	id?: string;
	playId: string;
	value: string;
	expire: string;
	url: string;
	permission: string | PlayTokenPermission;
	meta?: {
		userId?: string;
		[key: string]: any;
	};
}

export interface Instance {
	id: string;
	gameCode: string;
	modules: InstanceModule[];
	status: string;
	region: string;
	exitCode?: number;
	entryPoint: string;
	cost: number;
	processName?: string;
}

export interface VideoSetting {
	videoPublishUri: string;
	videoFrameRate: number;
}

export interface FindPlayRequest extends PagingRequest {
	gameCode?: string;
	status?: string[];
	order?: string;
}

export interface CreatePlayRequest {
	gameCode?: string;
	parent?: {
		playId?: string;
		playData?: string;
		frame?: number;
	};
}

export interface InstanceModule {
	code: string;
	values: any;
}

export interface FindInstanceRequest extends PagingRequest {
	gameCode?: string;
	status?: string[];
	entryPoint?: string;
	videoPublishUri?: string;
	processName?: string;
}

export interface CreatePlaylogEventRequest {
	type: string;
	values: any;
}

export interface Reservation {
	endpoint: string;
}

export interface FindReportsRequest extends PagingRequest {
	_sort?: string;
	condition?: string;
	since?: Date;
	until?: Date;
}
