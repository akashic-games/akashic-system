import config from "config";
import { DispatcherClient, EmptyResponse, PlayToken, SystemApiClient } from "../src";

describe("Dispatching", function () {
	let client: SystemApiClient;
	let dispatcher: DispatcherClient;
	let tokensPerPlay: { [playId: string]: PlayToken[] };

	beforeEach(() => {
		client = new SystemApiClient(config.get<string>("service.baseUrl"));
		dispatcher = new DispatcherClient(config.get<string>("dispatcher.baseUrl"));
		tokensPerPlay = {};
	});

	afterEach((done) => {
		const cleaner = Object.keys(tokensPerPlay).map((playId) => {
			return tokensPerPlay[playId].map((token) => {
				return client.deletePlayToken(token.playId, token.value).catch((e) => Promise.resolve());
			});
		});
		const flattened = cleaner.reduce((a, b) => a.concat(b)) || [Promise.resolve()];
		Promise.all(flattened).then(() => {
			tokensPerPlay = {};
			client = null;
			dispatcher = null;
			done();
		});
	});

	function createPlayAndTokens(numPlays: number, numTokens: number, tokensPerPlay: any) {
		const gameCodePrefix = "dispathing_test_";
		const permission = "120";

		const createPlayPromises: Array<Promise<any>> = new Array<Promise<any>>();
		for (let i = 0; i < numPlays; ++i) {
			createPlayPromises.push(
				client.createPlay(gameCodePrefix + i).then((res) => {
					const playId = res.data.id;
					const createPlayTokenPromises: Array<Promise<any>> = new Array<Promise<any>>();
					for (let i = 0; i < numTokens; ++i) {
						createPlayTokenPromises.push(
							client
								.createPlayToken(playId, i.toString(), permission)
								.then((res) => {
									if (!tokensPerPlay[playId]) {
										tokensPerPlay[playId] = new Array<PlayToken>();
									}
									tokensPerPlay[playId].push(res.data);
									return Promise.resolve();
								})
								.catch((e) => {
									console.error("createPlayToken error:", e);
									return Promise.resolve();
								}),
						);
					}
					return Promise.all(createPlayTokenPromises);
				}),
			);
		}
		return createPlayPromises;
	}

	function reservePlay(trait: string, tokensPerPlay: any, async?: boolean) {
		let i = 0;
		const reservers = Object.keys(tokensPerPlay).map((playId) => {
			return tokensPerPlay[playId].map((token: any) => {
				return () =>
					dispatcher
						.reservePlay(trait, playId, token.value)
						.then((res) => {
							// TODO: クラスタ情報（コストなど）を参照できれば
							// 同一プレーが同一のURLに割り当てられるなどのチェックができる
							console.log(++i, "reservePlay success", trait, playId, ":", res.data.endpoint);
						})
						.catch((e) => {
							console.error(++i, "reservePlay error", trait, playId, ":", e.message);
						});
			});
		});
		const flattened = reservers.reduce((a, b) => a.concat(b)) || [Promise.resolve()];
		if (async) {
			return Promise.all(flattened.map((f: any) => f()));
		} else {
			return flattened.reduce((previous: any, current: any) => {
				return previous.then(current);
			}, Promise.resolve());
		}
	}

	it("websocket: 2 plays x 40 clients 割り当て", (done) => {
		const numPlays = 2;
		const numTokens = 40;

		Promise.all(createPlayAndTokens(numPlays, numTokens, tokensPerPlay))
			.then(() => {
				const trait = "standard_websocket";
				return reservePlay(trait, tokensPerPlay);
			})
			.then(done)
			.catch((err) => {
				console.error("error", err);
				done.fail(err);
			});
	});

	it("long_polling: 4 plays x 20 clients 割り当て", (done) => {
		const numPlays = 4;
		const numTokens = 20;

		Promise.all(createPlayAndTokens(numPlays, numTokens, tokensPerPlay))
			.then(() => {
				const trait = "standard_long_polling";
				return reservePlay(trait, tokensPerPlay);
			})
			.then(done)
			.catch((err) => {
				console.error("error", err);
				done.fail(err);
			});
	});
});
