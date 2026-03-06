import config from "config";
import { DispatcherClient, PlayToken, SystemApiClient } from "../src";

describe("Token API Dispatching", function () {
	let client: SystemApiClient;
	let dispatcher: DispatcherClient;
	let tokensPerPlay: { [playId: string]: PlayToken[] };

	beforeEach(() => {
		client = new SystemApiClient(config.get<string>("dispatchingSystemAPIServer.baseUrl"));
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

	function createPlayAndTokens(trait: string, numPlays: number, numTokens: number, tokensPerPlay: any) {
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
								.createPlayToken(playId, i.toString(), permission, { trait })
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

	it("websocket: 2 plays x 40 clients 割り当て", (done) => {
		const numPlays = 2;
		const numTokens = 40;
		const trait = "standard_websocket";

		Promise.all(createPlayAndTokens(trait, numPlays, numTokens, tokensPerPlay))
			.then(done)
			.catch((err) => {
				console.error("error", err);
				done.fail(err);
			});
	});

	it("long_polling: 4 plays x 20 clients 割り当て", (done) => {
		const numPlays = 4;
		const numTokens = 20;
		const trait = "standard_long_polling";

		Promise.all(createPlayAndTokens(trait, numPlays, numTokens, tokensPerPlay))
			.then(done)
			.catch((err) => {
				console.error("error", err);
				done.fail(err);
			});
	});
});
