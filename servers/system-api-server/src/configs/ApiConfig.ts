export interface ApiHost {
	baseUrl: string;
}
export interface ApiConfigs {
	permissionServer: ApiHost;
	play: ApiHost;
	playLogEvent: ApiHost;
	instance: ApiHost;
	report: ApiHost;
}
