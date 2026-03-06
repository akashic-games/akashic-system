function wait<T>(time: number, cont: () => Promise<T>): Promise<T> {
	return new Promise((resolve) => {
		setTimeout(() => {
			resolve();
		}, time);
	}).then(cont);
}

export function waitAndRun(retryCount: number, waitTime: number, test: () => Promise<void>): Promise<void> {
	let f = () => wait(waitTime, test);
	let result: Promise<void> = Promise.resolve(undefined);
	for (let i = retryCount; i > 0; i--) {
		result = f()
			.then(() => {
				f = () => Promise.resolve(undefined);
			})
			.catch((error) => {
				if (i > 1) {
					return Promise.resolve(undefined);
				} else {
					return Promise.reject(error);
				}
			});
	}
	return result;
}
