import { Mutex } from "./Mutex";

describe("Mutex", () => {
	it("same key - run and locked", (cb: Function) => {
		const expectValue = [1, 2, 3, 4, 5];
		const actualValue: number[] = [];
		const mutex = new Mutex();
		const p1 = mutex.enterLockSection("key", () => {
			actualValue.push(1);
			return wait(200)
				.then(() => actualValue.push(2))
				.then(() => wait(200))
				.then(() => actualValue.push(3));
		});
		const p2 = mutex.enterLockSection("key", () => {
			actualValue.push(4);
			return wait(20).then(() => actualValue.push(5));
		});
		Promise.all([p1, p2]).then(() => {
			expect(expectValue).toEqual(actualValue);
			cb();
		});
	});
	it("same key - runError and locked", (cb: Function) => {
		const expectValue = [1, 4, 5];
		const actualValue: number[] = [];
		const mutex = new Mutex();
		const p1 = mutex
			.enterLockSection("key", () => {
				actualValue.push(1);
				return wait(200).then(() => Promise.reject(new Error("runError")));
			})
			.catch<number>((error: Error) => {
				expect(error.message).toBe("runError");
				return undefined;
			});
		const p2 = mutex.enterLockSection("key", () => {
			actualValue.push(4);
			return wait(20).then(() => actualValue.push(5));
		});
		Promise.all([p1, p2]).then(() => {
			expect(expectValue).toEqual(actualValue);
			cb();
		});
	});
	it("same key - three", (cb: Function) => {
		const expectValue = [1, 2, 3, 4, 5, 6, 7];
		const actualValue: number[] = [];
		const mutex = new Mutex();
		const p1 = mutex.enterLockSection("key", () => {
			actualValue.push(1);
			return wait(200)
				.then(() => actualValue.push(2))
				.then(() => wait(200))
				.then(() => actualValue.push(3));
		});
		const p2 = mutex.enterLockSection("key", () => {
			actualValue.push(4);
			return wait(20).then(() => actualValue.push(5));
		});
		const p3 = mutex.enterLockSection("key", () => {
			actualValue.push(6);
			return wait(100).then(() => actualValue.push(7));
		});
		Promise.all([p1, p2, p3]).then(() => {
			expect(expectValue).toEqual(actualValue);
			cb();
		});
	});
	it("other key - run and locked", (cb: Function) => {
		const expectValue = [1, 4, 5, 2, 3];
		const actualValue: number[] = [];
		const mutex = new Mutex();
		const p1 = mutex.enterLockSection("key1", () => {
			actualValue.push(1);
			return wait(200)
				.then(() => actualValue.push(2))
				.then(() => wait(200))
				.then(() => actualValue.push(3));
		});
		const p2 = mutex.enterLockSection("key2", () => {
			actualValue.push(4);
			return wait(20).then(() => actualValue.push(5));
		});
		Promise.all([p1, p2]).then(() => {
			expect(expectValue).toEqual(actualValue);
			cb();
		});
	});
	it("other key - runError and locked", (cb: Function) => {
		const expectValue = [1, 4, 5, 2];
		const actualValue: number[] = [];
		const mutex = new Mutex();
		const p1 = mutex
			.enterLockSection("key1", () => {
				actualValue.push(1);
				return wait(200)
					.then(() => actualValue.push(2))
					.then(() => Promise.reject(new Error("runError")));
			})
			.catch<number>((error: Error) => {
				expect(error.message).toBe("runError");
				return undefined;
			});
		const p2 = mutex.enterLockSection("key2", () => {
			actualValue.push(4);
			return wait(20).then(() => actualValue.push(5));
		});
		Promise.all([p1, p2]).then(() => {
			expect(expectValue).toEqual(actualValue);
			cb();
		});
	});
	it("other key - three", (cb: Function) => {
		const expectValue = [1, 4, 6, 5, 7, 2, 3];
		const actualValue: number[] = [];
		const mutex = new Mutex();
		const p1 = mutex.enterLockSection("key1", () => {
			actualValue.push(1);
			return wait(200)
				.then(() => actualValue.push(2))
				.then(() => wait(200))
				.then(() => actualValue.push(3));
		});
		const p2 = mutex.enterLockSection("key2", () => {
			actualValue.push(4);
			return wait(20).then(() => actualValue.push(5));
		});
		const p3 = mutex.enterLockSection("key3", () => {
			actualValue.push(6);
			return wait(100).then(() => actualValue.push(7));
		});
		Promise.all([p1, p2, p3]).then(() => {
			expect(expectValue).toEqual(actualValue);
			cb();
		});
	});
});

function wait(time: number) {
	return new Promise<void>((resolve) => {
		setTimeout(function () {
			resolve(undefined);
		}, time);
	});
}
