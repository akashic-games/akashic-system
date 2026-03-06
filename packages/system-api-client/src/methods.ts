export default {
	findPlays: {
		path: "/v1.0/plays?gameCode=:gameCode&status[]=:status&_offset=:_offset&_limit=:_limit&_count=:_count&order=:order",
		method: "GET",
	},
	getPlay: {
		path: "/v1.0/plays/:playId",
		method: "GET",
	},
	createPlay: {
		path: "/v1.0/plays",
		method: "POST",
	},
	deletePlay: {
		path: "/v1.0/plays/:playId",
		method: "DELETE",
	},
	patchPlay: {
		path: "/v1.0/plays/:playId",
		method: "PATCH",
	},
	createPlayToken: {
		path: "/v1.0/plays/:playId/tokens",
		method: "POST",
	},
	deletePlayToken: {
		path: "/v1.0/plays/:playId/tokens/purge",
		method: "DELETE",
	},
	findPlayInstances: {
		path: "/v1.0/plays/:playId/instances",
		method: "GET",
	},
	createPlaylogEvent: {
		path: "/v1.0/plays/:playId/events",
		method: "POST",
	},
	getPlaylog: {
		path: "/v1.0/plays/:playId/playlog",
		method: "GET",
	},
	getInstance: {
		path: "/v1.0/instances/:instanceId",
		method: "GET",
	},
	createInstance: {
		path: "/v1.0/instances",
		method: "POST",
	},
	deleteInstance: {
		path: "/v1.0/instances/:instanceId",
		method: "DELETE",
	},
	findInstance: {
		path:
			"/v1.0/instances?gameCode=:gameCode&status[]=:status&entryPoint=:entryPoint" +
			"&videoPublishUri=:videoPublishUri&processName=:processName&_offset=:_offset&_limit=:_limit&_count=:_count",
		method: "GET",
	},
	reservePlay: {
		path: "/v1.0/endpoints/:trait/plays/:playId/reservations",
		method: "POST",
	},
	findReports: {
		path: "/v1.0/reports?condition=:condition&since=:since&until=:until&_offset=:_offset&_limit=:_limit&_sort=:_sort",
		method: "GET",
	},
	createPlayChildren: {
		path: "/v1.0/plays/:playId/children",
		method: "POST",
	},
	deletePlayChildren: {
		path: "/v1.0/plays/:playId/children/:childId",
		method: "DELETE",
	},
};
