const methods = {
	permissionServer: {
		generateToken: {
			path: "/v1.0/plays/:playId/tokens",
			method: "POST",
		},
		deleteToken: {
			path: "/v1.0/plays/:playId/tokens/purge",
			method: "DELETE",
		},
		validateToken: {
			path: "/v1.0/tokens/validate",
			method: "POST",
		},
	},
	play: {
		getPlays: {
			path: "/v1.0/plays?gameCode=:gameCode&status[]=:status&_offset=:_offset&_limit=:_limit&_count=:_count&order=:order",
			method: "GET",
		},
		createPlay: {
			path: "/v1.0/plays",
			method: "POST",
		},
		getPlay: {
			path: "/v1.0/plays/:id",
			method: "GET",
		},
		patchPlay: {
			path: "/v1.0/plays/:id",
			method: "PATCH",
		},
		stopPlay: {
			path: "/v1.0/plays/:id",
			method: "DELETE",
		},
		createPlayChildren: {
			path: "/v1.0/plays/:id/children",
			method: "POST",
		},
		deletePlayChildren: {
			path: "/v1.0/plays/:id/children/:childId",
			method: "DELETE",
		},
	},
	playLogEvent: {
		createEvent: {
			path: "/v1.0/plays/:id/events",
			method: "POST",
		},
		getPlaylog: {
			path: "/v1.0/plays/:id/playlog",
			method: "GET",
		},
		copyPlaylog: {
			path: "/v1.0/plays/:id/playlog",
			method: "POST",
		},
		putStartPoint: {
			path: "/v1.0/plays/:id/startpoints",
			method: "POST",
		},
		putTick: {
			path: "/v1.0/plays/:id/ticks",
			method: "POST",
		},
	},
	master: {
		patchInstance: {
			path: "/v1.0/instances/:id",
			method: "PATCH",
		},
		isMaster: {
			path: "/v1.0/master/state",
			method: "GET",
		},
	},
	instance: {
		createInstance: {
			path: "/v1.0/instances",
			method: "POST",
		},
		deleteInstance: {
			path: "/v1.0/instances/:id",
			method: "DELETE",
		},
		getInstancesByPlayId: {
			path: "/v1.0/plays/:playId/instances",
			method: "GET",
		},
		findInstance: {
			path: "/v1.0/instances?gameCode=:gameCode&status[]=:status&entryPoint=:entryPoint&videoPublishUri=:videoPublishUri&processName=:processName&_offset=:_offset&_limit=:_limit&_count=:_count",
			method: "GET",
		},
		getInstance: {
			path: "/v1.0/instances/:id",
			method: "GET",
		},
		patchInstance: {
			path: "/v1.0/instances/:id",
			method: "PATCH",
		},
		getVideoSettings: {
			path: "/v1.0/videoSettings?instanceIds[]=:instanceIds",
			method: "GET",
		},
		getVideoSetting: {
			path: "/v1.0/instances/:id/videoSetting",
			method: "GET",
		},
	},
	report: {
		getReports: {
			path: "/v1.0/reports?condition=:condition&since=:since&until=:until&_offset=:_offset&_limit=:_limit&_sort=:_sort",
			method: "GET",
		},
	},
};
export = methods;
